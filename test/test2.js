var chunkingStreams = require('chunking-streams'),
  fs = require('fs'),
  path = require('path'),
  Differ = require('../../fs-dif/lib/fs-dif'),
  randomAccessFile = require('random-access-file');

var osx = './test/data';
var dir = osx;

//https://github.com/thlorenz/readdirp#filters
var SizeChunker = chunkingStreams.SizeChunker;

var fsDif = new Differ({
  dirToWatch: dir, //REQUIRED: directory to watch
  directoryFilter: ['!*modules'],
  ignoreDotFiles: true
});

var outputFile,
  offset;


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

    if (outputFile)
      outputFile.close();

    outputFile = randomAccessFile(path.basename(data.fileName));

    var input = fs.createReadStream(data.fileName);

    var chunker = new SizeChunker({
      chunkSize: 1024,
      flushTail: true
    });

    chunker.on('data', function(chunk) {

      if (chunk.data.length == 0)
        return;
      offset = chunk.id * chunk.data.length;
      outputFile.write(offset, chunk.data, function(err) {
        if (err) console.error(err);
      });

    });

    input.pipe(chunker);

  });

});
