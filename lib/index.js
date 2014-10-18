var chunkingStreams = require('chunking-streams'),
  fs = require('fs'),
  xxhash = require('xxhash'),
  through = require('through'),
  util = require('util'),
  StreamBouncer = require('stream-bouncer'),
  events = require('events');

var FsDiffStream = function(options){

  options = options || {};

  if(!options.chunkSize && !options.chunkCount){
    options.chunkSize = 2048;
  }

  var SizeChunker = chunkingStreams.SizeChunker,
    fileMerkel = {},
    self = this,
    _fileName;

  var _addToMerkel = (function(merkel) {
    var buffer;
    return function(chunk) {
      if (!merkel[chunk.id]){
        merkel[chunk.id] = [chunk];
        buffer = new Buffer(chunk.data.length);
        buffer.copy(chunk.data);
        _emit('uniqueChunk', null, {
          id: chunk.id,
          hash: chunk.hash,
          data: chunk.data
        });
        delete chunk.data;
      }
      else if(merkel[chunk.id].length > 1){
        merkel[chunk.id].splice(0, 1);
        merkel[chunk.id].push(chunk);
      }else{
        merkel[chunk.id].push(chunk);
      }
    };
  })(fileMerkel);

  function _emit(event, err, data) {
    self.emit(event, err, data);
  };

  function _on(event, cb) {
    self.on(event, cb);
  };

  var _getChunkSize = function(count){

    //debugger;

    if(!options.chunkCount)
      return options.chunkSize;

    var size = fs.statSync(_fileName).size, chunkSize,
      chunkCount = options.chunkCount;

    chunkSize = Math.floor(size/chunkCount) + 1;

    return chunkSize;
  };

  var _showDifferences = function(merkel){

    var good, result, hash, buffer;

    for(var key in merkel){

      if(!merkel[key] ||
        merkel[key].length < 2){
        continue;
      }

      hash = merkel[key];

      good = hash[0].hash == hash[1].hash;

      hash[1].fileName = _fileName;

      if(!good){
        debugger;
        buffer = new Buffer(hash[1].data.length);
        buffer.copy(hash[1].data);
        _emit('chunkChanged', null, hash[1]);
      }

      delete hash[1].data;
    }
  };

  var _bouncer = new StreamBouncer({
    streamsPerTick: 1,
    poll: 1000
  });
  
  _bouncer.on('close', function(){
    _showDifferences(fileMerkel);
  });

  var _chunkFile = function(fileName) {

    var input = fs.createReadStream(fileName);

    var chunker = new SizeChunker({
      chunkSize: _getChunkSize(),
      flushTail: true
    });

    chunker.on('data', function(chunk) {

      if (chunk.data.length == 0) return;

      chunk.hash = xxhash.hash(chunk.data, 0xCAFEBABE);
      //chunk.data = chunk.data.toString('base64')
      _addToMerkel(chunk);

    });

    _bouncer.push({
      source: input,
      destination: chunker
    });

  };

  var compare = function(filename){
    _fileName = filename;
    process.nextTick(function(){
      if(!fs.existsSync(_fileName)) {
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
