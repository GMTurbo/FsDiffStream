var chunkingStreams = require('chunking-streams'),
  fs = require('fs'),
  xxhash = require('xxhash'),
  StreamBouncer = require('stream-bouncer'),
  Differ = require('../../fs-dif/lib/fs-dif'),
  colors = require('colors');
  fsDiffStream = require('../../FsDiffStream/lib/index.js')

var osx = './test/';
var dir = osx;

//https://github.com/thlorenz/readdirp#filters


var fsDif = new Differ({
  dirToWatch: dir, //REQUIRED: directory to watch
  debugOutput: true, //turn on verbose output logging,
  directoryFilter: ['!*modules'],
  ignoreDotFiles: true
});

var diffStream = new fsDiffStream();

diffStream.on('chunkChanged', function(err, data){
  if(err) console.error(err);
  console.log('chunkChanged', data);
});

diffStream.on('uniqueChunk', function(err, data){
  if(err) console.error(err);
  console.log('uniqueChunk', data);
});

fsDif.on('ready', function() {

  console.log('fsDif ready to rock');

  fsDif.beginWatch();

  fsDif.on('renamed', function(err, data) {
    //console.log('renamed', data);
  });

  fsDif.on('moved', function(err, data) {
    //console.log('moved', data);
  });

  fsDif.on('changed', function(err, data) {
    //console.log('moved', data);
    if (err)
      process.exit();
    diffStream.compare(data.fileName);
  });

});
