var fs = require('fs'),
  path = require('path'),
  Differ = require('../../fs-dif/lib/fs-dif'),
  fsDiffStream = require('../../FsDiffStream/lib/index.js'),
  randomAccessFile = require('random-access-file'),
  randomAccessRemove = require('random-access-remove');

var osx = './test/data';
var dir = osx;

//https://github.com/thlorenz/readdirp#filters


var fsDif = new Differ({
  dirToWatch: dir, //REQUIRED: directory to watch
  directoryFilter: ['!*modules'],
  ignoreDotFiles: true
});

var chunkSize = 1024 * 10;

var diffStream = new fsDiffStream({
  chunkSize: chunkSize
});

var outputFile,
  offset,
  rar = new randomAccessRemove();

var orderFile = function(filename, blockCount, oldCount) {

  if (oldCount > blockCount) {

    rar.remove(
      filename,
      blockCount * chunkSize,
      (oldCount - blockCount) * chunkSize,
      function(err) {
      if (err)
        console.error(err);
    });

  }
};

diffStream.on('fileResize', function(err, data) {
  if (err) console.error(err);
  debugger;
  orderFile(data.fileName, data.chunkCount, data.prevChunkCount);
  // outputFile.read(offset, chunk.data, function(err) {
  //   if(err) console.error(err);
  // });
});

diffStream.on('chunkChanged', function(err, chunk) {
  if (err) console.error(err);
  console.log('chunkChanged', chunk);
  offset = chunk.id * chunk.targetChunkSize;
  outputFile.write(offset, chunk.data, function(err) {
    if (err) console.error(err);
  });
});

diffStream.on('chunkRemoved', function(err, data) {
  if (err) console.error(err);
  console.log('chunkRemoved', data);
  //offset = data.id * data.data.length;
  // outputFile.write(data.data.offset || 0, data.data, function(err) {
  //   if(err) console.error(err);
  // });
});

diffStream.on('uniqueChunk', function(err, chunk) {
  if (err) console.error(err);
  console.log('uniqueChunk', chunk);
  offset = chunk.id * chunk.targetChunkSize;
  outputFile.write(offset, chunk.data, function(err) {
    if (err) console.error(err);
  });
});

fsDif.on('ready', function() {

  console.log('fsDif ready to rock');

  fsDif.beginWatch();

  fsDif.on('removed', function(err, data) {
    console.log('removed', data);
    diffStream.remove(data.fileName);
  });

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

    if (outputFile)
      outputFile.close();

    outputFile = randomAccessFile(path.basename(data.fileName));
    diffStream.compare(data.fileName);
  });

});
