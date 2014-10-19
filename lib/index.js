var chunkingStreams = require('chunking-streams'),
  fs = require('fs'),
  xxhash = require('xxhash'),
  util = require('util'),
  events = require('events'),
  StreamBouncer = require('stream-bouncer');

var FsDiffStream = function(options) {

  if (!(this instanceof FsDiffStream))
     return new FsDiffStream(options);

  options = options || {};

  if (!options.chunkSize && !options.chunkCount) {
    options.chunkSize = 2048;
  }

  var SizeChunker = chunkingStreams.SizeChunker,
    fileMerkel = {},
    self = this,
    _chunkCount,
    _chunkSize,
    _fileName;

  var _bouncer = new StreamBouncer({
    streamsPerTick: 1,
    poll: 100
  });

  _bouncer.on('count', function(count) {
    console.log(count + ' streams remaining');
  });

  _bouncer.on('start', function(sourceStream) {
    console.log(sourceStream.path + ' started');
  });

  var _addToMerkel = function(chunk) {
    if (!fileMerkel[chunk.id]) {

      fileMerkel[chunk.id] = [chunk];

      chunk.fileName = _fileName;
      chunk.targetChunkSize = _chunkSize;
      _emit('uniqueChunk', null, chunk);

      delete chunk.data;

    } else if (fileMerkel[chunk.id].length >= 1) {

      if (fileMerkel[chunk.id].length == 2)
        fileMerkel[chunk.id].splice(0, 1);

      fileMerkel[chunk.id].push(chunk);

      _checkForDifference(fileMerkel[chunk.id]);

    }
  };

  var _checkForDifference = function(pieces) {

    var good = pieces[0].hash == pieces[1].hash;

    if (!good) {
      if (!pieces[1].data) {
        _emit('chunkRemoved', null, pieces[1].id);
      } else {

        pieces[1].fileName = _fileName;
        pieces[1].targetChunkSize = _chunkSize;
        _emit('chunkChanged', null, pieces[1]);

        delete pieces[1].data;
      }
    }
  };

  function _emit(event, err, data) {
    self.emit(event, err, data);
  };

  function _on(event, cb) {
    self.on(event, cb);
  };

  var _getChunkSize = function(count) {

    if (!options.chunkCount) {
      _chunkSize = options.chunkSize;
      var size = fs.statSync(_fileName).size;
      var totalBlocks = Math.floor(size / options.chunkSize) + 1;
      if (_chunkCount && _chunkCount != totalBlocks) {
        _chunkCount = totalBlocks;
        _emit('resize', null, {
          count: _chunkCount,
          fileName: _fileName
        });
      }
      return _chunkSize;
    }

    _chunkCount = options.chunkCount;
    var size = fs.statSync(_fileName).size;

    _chunkSize = Math.floor(size / options.chunkCount) + 1;

    return _chunkSize;
  };

  var _chunkFile = function(fileName) {

    var source = fs.createReadStream(fileName);

    var chunker = new SizeChunker({
      chunkSize: _getChunkSize(),
      flushTail: true
    });

    chunker.on('data', function(chunk) {

      if (chunk.data.length == 0)
        return;

      chunk.hash = xxhash.hash(chunk.data, 0xCAFEBABE);
      chunk.length = chunk.data.length;
      //chunk.data = chunk.data.toString('base64')
      _addToMerkel(chunk);

    });

    _bouncer.push({
      source: source,
      destination: chunker
    });

  };

  var compare = function(filename) {
    _fileName = filename;
    process.nextTick(function() {
      if (!fs.existsSync(_fileName)) {
        console.error(_fileName + " doesn't exist :(");
        return;
      }

      _chunkFile(_fileName);
    });
  }

  return {
    compare: compare,
    on: _on
  };
};

util.inherits(FsDiffStream, events.EventEmitter);

module.exports = FsDiffStream;
