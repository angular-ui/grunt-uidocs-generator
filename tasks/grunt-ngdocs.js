/*
 * grunt-ngdocs
 * https://github.com/m7r/grunt-ngdocs
 *
 * Copyright (c) 2013 m7r
 * Licensed under the MIT license.
 */

var reader = require('../src/reader.js'),
    ngdoc = require('../src/ngdoc.js'),
    path = require('path'),
    vm = require('vm');

module.exports = function(grunt) {
  var _ = grunt.util._,
      templates = path.resolve(__dirname, '../src/templates');

  grunt.registerMultiTask('ngdocs', 'build documentation', function() {
    var start = now(),
        done = this.async(),
        options = this.options({
          dest: 'docs/',
          scripts: ['js/angular.min.js']
        }),
        section = this.target === 'all' ? 'api' : this.target,
        setup = prepareSetup(section, options);

    grunt.log.writeln('Generating Documentation...');

    reader.docs = [];
    this.files.forEach(function(f) {
      setup.sections[section] = f.title || 'API Documentation';
      f.src.filter(exists).forEach(function(filepath) {
        var content = grunt.file.read(filepath);
        reader.process(content, filepath, section);
      });
    });

    ngdoc.merge(reader.docs);

    reader.docs.forEach(function(doc){
      // this hack is here because on OSX angular.module and angular.Module map to the same file.
      var id = doc.id.replace('angular.Module', 'angular.IModule'),
          file = path.resolve(options.dest, 'partials', doc.section, id + '.html');
      grunt.file.write(file, doc.html());
    });

    setup.pages = _.union(setup.pages, ngdoc.metadata(reader.docs));

    writeSetup(setup);

    grunt.log.writeln('DONE. Generated ' + reader.docs.length + ' pages in ' + (now()-start) + 'ms.');
    done();
  });

  function prepareSetup(section, options) {
    var setup, data, context = {},
        file = path.resolve(options.dest, 'js/docs-setup.js');
    if (exists(file)) {
      // read setup from file
      data = grunt.file.read(file),
      vm.runInNewContext(data, context, file);
      setup = context.NG_DOCS;
      // keep only pages from other build tasks
      setup.pages = _.filter(setup.pages, function(p) {return p.section !== section;});
    } else {
      // build clean dest
      setup = {sections: {}, pages: []};
      copyTemplates(options.dest);
    }
    setup.__file = file;
    setup.__options = options;
    return setup;
  }

  function writeSetup(setup) {
    var options = setup.__options,
        content, data = {
          scripts: options.scripts,
          sections: _.keys(setup.sections).join('|'),
          discussions: options.discussions,
          analytics: options.analytics
        };

    // create index.html
    content = grunt.file.read(path.resolve(templates, 'index.tmpl'));
    content = grunt.template.process(content, {data:data});
    grunt.file.write(path.resolve(options.dest, 'index.html'), content);

    // create setup file
    setup.discussions = options.discussions;
    setup.scripts = _.map(options.scripts, function(url) { return path.basename(url); });
    grunt.file.write(setup.__file, 'NG_DOCS=' + JSON.stringify(setup, replacer, 2) + ';');
  }


  function copyTemplates(dest) {
    grunt.file.expandMapping(['**/*', '!**/*.tmpl'], dest, {cwd: templates}).forEach(function(f) {
      var src = f.src[0],
          dest = f.dest;
      if (grunt.file.isDir(src)) {
          grunt.file.mkdir(dest);
        } else {
          grunt.file.copy(src, dest);
        }
    });
  }

  function exists(filepath) {
    return !!grunt.file.exists(filepath);
  }

  function replacer(key, value) {
    if (key.substr(0,2) === '__') {
      return undefined;
    }
    return value;
  }

  function now() { return new Date().getTime(); }

 };