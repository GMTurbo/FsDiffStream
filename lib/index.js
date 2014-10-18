var chunkingStreams = require('chunking-streams'),
  fs = require('fs'),
  xxhash = require('xxhash'),
  colors = require('colors'),
  through = require('through');

var FsDiffStream = function(options){

  options = options || {};

  return {

  };
};

var SizeChunker = chunkingStreams.SizeChunker;

var fileMerkel = {};

var addToMerkel = (function(merkel) {
  return function(chunk) {
    if (!merkel[chunk.id])
      merkel[chunk.id] = [chunk.data];
    else if(merkel[chunk.id].length > 2){
      merkel[chunk.id].splice(0, 1);
      merkel[chunk.id].push(chunk.data);
    }else{
      merkel[chunk.id].push(chunk.data);
    }
  };
})(fileMerkel);

var showDifferences = function(merkel){

  var good, result, hash;
  console.log('\n\n\tshowing differences: ')
  for(var key in merkel){

    if(!merkel[key] ||
      merkel[key].length < 2){
      continue;
    }
    hash = merkel[key];

    good = hash[0] == hash[1];
    if(good){
      result = hash.toString().green;
    }
    else{
      result = hash.toString().red;
    }
    console.log(result);

  }
};

var bouncer = new StreamBouncer({
  streamsPerTick: 1,
  poll: 1000
});

var chunkFile = function(fileName) {

  var input = fs.createReadStream(fileName);

  var chunker = new SizeChunker({
    chunkSize: 1024,
    flushTail: true
  });

  chunker.on('data', function(chunk) {

    if (chunk.data.length == 0) return;

    chunk.data = xxhash.hash(chunk.data, 0xCAFEBABE);

    addToMerkel(chunk);

  });

  bouncer.on('close', function(){
    showDifferences(fileMerkel);
  });

  bouncer.push({
    source: input,
    destination: chunker
  });
  //input.pipe(chunker);
};
