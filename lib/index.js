var chunkingStreams = require('chunking-streams'),
  fs = require('fs'),
  xxhash = require('xxhash'),
  through = require('through'),
  util = require('util'),
  StreamBouncer = require('stream-bouncer'),
  events = require('events');

var FsDiffStream = function(options){

  options = options || {};
  options.chunkSize = options.chunkSize || 2048;

  var SizeChunker = chunkingStreams.SizeChunker,
    fileMerkel = {},
    self = this;

  var _addToMerkel = (function(merkel) {
    return function(chunk) {
      if (!merkel[chunk.id]){
        merkel[chunk.id] = [chunk];
        _emit('uniqueChunk', null, chunk);
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

  var _showDifferences = function(merkel){

    var good, result, hash;

    for(var key in merkel){

      if(!merkel[key] ||
        merkel[key].length < 2){
        continue;
      }

      hash = merkel[key];

      good = hash[0].hash == hash[1].hash;

      hash[1].fileName = fileName;

      if(!good){
        _emit('chunkChanged', null, hash[1]);
      }

      delete hash[1].data;
    }
  };

  var _bouncer = new StreamBouncer({
    streamsPerTick: 1,
    poll: 1000
  });

  var _chunkFile = function(fileName) {

    var input = fs.createReadStream(fileName);

    var chunker = new SizeChunker({
      chunkSize: options.chunkSize,
      flushTail: true
    });

    chunker.on('data', function(chunk) {

      if (chunk.data.length == 0) return;

      chunk.hash = xxhash.hash(chunk.data, 0xCAFEBABE);
      //chunk.data = chunk.data.toString('base64')
      _addToMerkel(chunk);

    });

    _bouncer.on('close', function(){
      _showDifferences(fileMerkel);
    });

    _bouncer.push({
      source: input,
      destination: chunker
    });

  };

  var fileName;

  var compare = function(filename){
    fileName = filename;
    process.nextTick(function(){
      if(!fs.existsSync(fileName)) {
        console.error(fileName + " doesn't exist :(");
        return;
      }

      _chunkFile(fileName);
    });
  }

  return {
    compare: compare,
    on: _on
  };
};

util.inherits(FsDiffStream, events.EventEmitter);

module.exports = FsDiffStream;
