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

  options.debug = options.debug || false;

  var SizeChunker = chunkingStreams.SizeChunker,
    fileMerkel = {},
    self = this,
    cb, resized,
    _chunkCount,
    _chunkSize,
    _fileName;

  var _bouncer = new StreamBouncer({
    streamsPerTick: 1,
    poll: 100
  });

  _bouncer.on('count', function(count) {
    options.debug && console.log(count + ' streams remaining');
  });

  _bouncer.on('start', function(sourceStream) {
    options.debug && console.log(sourceStream.path + ' started');
  });

  _bouncer.on('close', function(sourceStream) {
    debugger;

    options.debug && console.log(sourceStream.path + ' finished');

    if (cb) {
      process.nextTick(function() {
        cb(null, resized)
      });
    }
  });

  //this isn't really a merkel anything, but
  // it's a bunch of hashes, so there you go
  var _addToMerkel = function(chunk) {

    //debugger;

    if (!fileMerkel[_fileName]) {

      fileMerkel[_fileName] = {
        totalChunks: _chunkCount
      };
    }

    var node = fileMerkel[_fileName];

    if (!node[chunk.id]) {

      node[chunk.id] = [chunk];

      //chunk.fileName = _fileName;
      //  chunk.targetChunkSize = _chunkSize;
      _emit('uniqueChunk', null, {
        fileName: _fileName,
        data: new Buffer(JSON.parse(JSON.stringify(chunk.data))),
        targetChunkSize: _chunkSize,
        length: chunk.data.length,
        id: chunk.id,
      });

      delete chunk.data;

    } else if (node[chunk.id].length >= 1) {

      if (node[chunk.id].length == 2)
        node[chunk.id].splice(0, 1);

      node[chunk.id].push(chunk);

      _checkForDifference(node[chunk.id]);

    }
  };

  var _checkForDifference = function(pieces) {

    var good = pieces[0].hash == pieces[1].hash;

    if (!good) {
      if (!pieces[1].data) {
        _emit('chunkRemoved', null, pieces[1].id);
      } else {

        _emit('chunkChanged', null, {
          fileName: _fileName,
          data: new Buffer(JSON.parse(JSON.stringify(pieces[1].data))),
          targetChunkSize: _chunkSize,
          length: pieces[1].data.length,
          id: pieces[1].id,
        });

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

    resized = null;
    if (!options.chunkCount) {

      _chunkSize = options.chunkSize;

      if (fileMerkel[_fileName] && fileMerkel[_fileName].totalChunks) {
        _chunkCount = fileMerkel[_fileName].totalChunks;
      } else {
        _chunkCount = undefined;
      }

      var totalBlocks = Math.floor(fs.statSync(_fileName).size / options.chunkSize) + 1;

      if (_chunkCount && _chunkCount != totalBlocks) {

        _chunkCount = totalBlocks;

        var prevChunkCount = fileMerkel[_fileName].totalChunks;

        fileMerkel[_fileName].totalChunks = _chunkCount;

        _emit('fileResize', null, {
          fileName: _fileName,
          chunkCount: _chunkCount,
          prevChunkCount: prevChunkCount
        });

        resized = {
          fileName: _fileName,
          chunkCount: _chunkCount,
          prevChunkCount: prevChunkCount
        };

      } else {
        _chunkCount = totalBlocks;
      }

      return _chunkSize;
    }

    _chunkCount = options.chunkCount;

    _chunkSize = Math.floor(fs.statSync(_fileName).size / options.chunkCount) + 1;

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

      _addToMerkel(chunk);

    });

    _bouncer.push({
      source: source,
      destination: chunker
    });

  };

  var remove = function(fileName) {
    delete fileMerkel[fileName];
  };

  var compare = function(filename, callback) {
    cb = callback;
    _fileName = filename;

    process.nextTick(function() {

      if (!fs.existsSync(_fileName)) {
        cb(_fileName + " doesn't exist :(");
        return;
      }

      _chunkFile(_fileName);
    });

  }

  return {
    compare: compare,
    remove: remove,
    on: _on
  };
};

util.inherits(FsDiffStream, events.EventEmitter);

module.exports = FsDiffStream;
