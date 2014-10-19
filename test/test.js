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

var diffStream = new fsDiffStream({
  chunkCount: 5
});

var outputFile,
  offset;

diffStream.on('chunkChanged', function(err, data){
  if(err) console.error(err);
  console.log('chunkChanged', data);
  offset = data.id * data.data.length;
  // outputFile.write(offset, data.data, function(err) {
  //   if(err) console.error(err);
  // });
});

diffStream.on('chunkRemoved', function(err, data){
  if(err) console.error(err);
  console.log('chunkRemoved', data);
  //offset = data.id * data.data.length;
  // outputFile.write(data.data.offset || 0, data.data, function(err) {
  //   if(err) console.error(err);
  // });
});

diffStream.on('uniqueChunk', function(err, data){
  if(err) console.error(err);
  console.log('uniqueChunk', data);
  offset = data.id * data.data.length;
  outputFile.write(offset, data.data, function(err) {
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
