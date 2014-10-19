var fs = require('fs'),
  path = require('path'),
  Differ = require('../../fs-dif/lib/fs-dif'),
  fsDiffStream = require('../../FsDiffStream/lib/index.js'),
  randomAccessFile = require('random-access-file');

var osx = './test/data';
var dir = osx;

//https://github.com/thlorenz/readdirp#filters


var fsDif = new Differ({
  dirToWatch: dir, //REQUIRED: directory to watch
  directoryFilter: ['!*modules'],
  ignoreDotFiles: true
});

var chunkSize = 4096;
var diffStream = new fsDiffStream({
  chunkSize: chunkSize
});

var outputFile,
  offset;

var orderFile = function(count){

  var offset;

  for(var i = 0 ; i < count; i++){
    offset = count * chunkSize;
    outputFile.read(offset, chunkSize, function(err, buffer) {
      if(err) console.error(err);
      outputFile.write(offset, buffer, function(err) {
        if(err) console.error(err);
      });
    });

  }
};

diffStream.on('resize', function(err, data){
  if(err) console.error(err);
  orderFile(data.count);
  outputFile.read(offset, chunk.data, function(err) {
    if(err) console.error(err);
  });
});

diffStream.on('chunkChanged', function(err, chunk){
  if(err) console.error(err);
  console.log('chunkChanged', chunk);
  offset = chunk.id * chunk.data.length;
  outputFile.write(offset, chunk.data, function(err) {
    if(err) console.error(err);
  });
});

diffStream.on('chunkRemoved', function(err, data){
  if(err) console.error(err);
  console.log('chunkRemoved', data);
  //offset = data.id * data.data.length;
  // outputFile.write(data.data.offset || 0, data.data, function(err) {
  //   if(err) console.error(err);
  // });
});

diffStream.on('uniqueChunk', function(err, chunk){
  if(err) console.error(err);
  console.log('uniqueChunk', chunk);
  offset = chunk.id * chunk.data.length;
  outputFile.write(offset, chunk.data, function(err) {
    if(err) console.error(err);
  });
});

fsDif.on('ready', function() {

  console.log('fsDif ready to rock');

  fsDif.beginWatch();

  fsDif.on('created', function(err, data) {
    console.log('created', data);
  });

  fsDif.on('exists', function(err, data) {
    console.log('exists', data);
  });

  fsDif.on('changed', function(err, data) {
    //console.log('moved', data);
    if (err)
      process.exit();

    if(outputFile)
      outputFile.close();

    outputFile = randomAccessFile(path.basename(data.fileName));
    diffStream.compare(data.fileName);
  });

});
