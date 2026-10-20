import 'dart:io';
import 'dart:typed_data';
import 'package:file_selector/file_selector.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';

const maxAudioBytes = 25 * 1024 * 1024;
const audioMimeTypes = <String, String>{
  'wav': 'audio/wav',
  'mp3': 'audio/mpeg',
  'm4a': 'audio/mp4',
  'ogg': 'audio/ogg',
  'opus': 'audio/opus',
  'webm': 'audio/webm',
  'flac': 'audio/flac',
};

class AudioImport {
  AudioImport(this.name, this.mimeType, this.bytes) {
    if (name.isEmpty ||
        name.length > 255 ||
        RegExp(r'[/\\\x00-\x1f\x7f]').hasMatch(name) ||
        !audioMimeTypes.values.contains(mimeType) ||
        bytes.isEmpty ||
        bytes.length > maxAudioBytes) {
      throw const FormatException('Choose an audio file up to 25 MiB.');
    }
  }
  final String name;
  final String mimeType;
  final Uint8List bytes;
}

/// Native ports are replaceable in tests. They never receive credentials or URLs.
abstract interface class RecordingMedia {
  Future<AudioImport?> pick();
  Future<void> load(Uint8List bytes);
  Future<void> play();
  Future<void> pause();
  Future<void> reset();
}

class NativeRecordingMedia implements RecordingMedia {
  AudioPlayer? _player;
  Directory? _directory;
  Future<void> _tail = Future<void>.value();

  Future<void> _serial(Future<void> Function() work) {
    final next = _tail.then((_) => work());
    // Later reset may finish cleanup; callers retain a failed admission gate.
    _tail = next.catchError((Object _) {});
    return next;
  }

  @override
  Future<AudioImport?> pick() async {
    final file = await openFile(
      acceptedTypeGroups: [
        XTypeGroup(
          label: 'Audio',
          extensions: audioMimeTypes.keys.toList(),
          uniformTypeIdentifiers: const ['public.audio'],
        ),
      ],
    );
    if (file == null) return null;
    final size = await file.length();
    if (size <= 0 || size > maxAudioBytes) {
      throw const FormatException('Choose an audio file up to 25 MiB.');
    }
    final extension = file.name.split('.').last.toLowerCase();
    final mime = audioMimeTypes[extension];
    if (mime == null) throw const FormatException('Unsupported audio file.');
    final builder = BytesBuilder(copy: false);
    await for (final chunk in file.openRead()) {
      if (builder.length + chunk.length > maxAudioBytes) {
        throw const FormatException('Choose an audio file up to 25 MiB.');
      }
      builder.add(chunk);
    }
    if (builder.length != size) {
      throw const FormatException('The file changed.');
    }
    return AudioImport(file.name, mime, builder.takeBytes());
  }

  @override
  Future<void> load(Uint8List bytes) => _serial(() async {
    await _clear();
    // Decoder reads a transient app-private cache file, never a remote URL.
    final cache = await getTemporaryDirectory();
    _directory = await Directory('${cache.path}/bota-playback-').createTemp();
    final file = File('${_directory!.path}/audio.wav');
    await file.writeAsBytes(bytes, flush: true);
    _player = AudioPlayer();
    try {
      await _player!.setFilePath(file.path);
    } catch (_) {
      await _clear();
      rethrow;
    }
  });

  @override
  Future<void> play() async {
    final player = _player;
    if (player == null) return;
    if (player.processingState == ProcessingState.completed) {
      await player.seek(Duration.zero);
    }
    // play() completes only on pause/end; UI must remain free to stop playback.
    await player.play();
  }

  @override
  Future<void> pause() async => _player?.pause();

  Future<void> _clear() async {
    final player = _player;
    await player?.dispose();
    _player = null;
    final directory = _directory;
    if (directory != null && await directory.exists()) {
      await directory.delete(recursive: true);
    }
    _directory = null;
  }

  @override
  Future<void> reset() => _serial(_clear);
}
