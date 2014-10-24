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

var chunkSize = 1024 * 4;

var diffStream = new fsDiffStream({
  chunkSize: chunkSize
});

var outputFile,
  offset, writing = false,
  rar = new randomAccessRemove();

var orderFile = function(filename, blockCount, oldCount) {

  if (oldCount > blockCount) {

    writing = true;

    if (outputFile) {
      outputFile.close(function() {
        rar.remove(
          filename,
          blockCount * chunkSize, (oldCount - blockCount) * chunkSize,
          function(err) {
            if (err)
              console.error(err);
            writing = false;
          });
      });
    } else {
      rar.remove(
        filename,
        blockCount * chunkSize, (oldCount - blockCount) * chunkSize,
        function(err) {
          if (err)
            console.error(err);
          writing = false;
        });
    }
  }
};

diffStream.on('fileResize', function(err, data) {
  if (err) console.error(err);
  debugger;
  //orderFile(path.basename(data.fileName), data.chunkCount, data.prevChunkCount);
  // outputFile.read(offset, chunk.data, function(err) {
  //   if(err) console.error(err);
  // });
});

diffStream.on('chunkChanged', function(err, chunk) {
  if (err) console.error(err);
  //console.log('chunkChanged', chunk);
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
  if (err)
    console.error(err);
  //console.log('uniqueChunk', chunk);
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
    console.log('changed', data);
    if (err)
      process.exit();

    var interval = setInterval(function(){
      if(writing)
        return;
      clearInterval(interval);
      handleChange(data);
    }, 100);

  });

  var handleChange = function(data){
    if (outputFile) {
      outputFile.close(function() {
        outputFile = randomAccessFile(path.basename(data.fileName));
        diffStream.compare(data.fileName, function(err, resized){
          console.log('dif finished');
          if(resized){
            orderFile(path.basename(resized.fileName), resized.chunkCount, resized.prevChunkCount);
          }
        });
      });
    } else {
      outputFile = randomAccessFile(path.basename(data.fileName));
      diffStream.compare(data.fileName, function(err, resized){
        console.log('dif finished');
        if(resized){
          orderFile(path.basename(resized.fileName), resized.chunkCount, resized.prevChunkCount);
        }
      });
    }
  }

});
