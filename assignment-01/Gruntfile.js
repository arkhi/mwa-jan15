module.exports = function(grunt) {
  // Global configuration
  // 
  // Only target minified files for references replacement, as they are the only files used in prod. 
  // The tiny_mce plugin has its files screwed up because they are not utf8 encoded: remove them.
  // ===========================================================================
  var cfg = {
    jsCwd:                'assets/js',
    cssCwd:               'assets/css',
    assetsWithReferences: [
      'web/css/**/*.min.css',
      'web/js/**/*.min.js',
    ]
  };

  // Grunt tasks configuration
  // ===========================================================================
  grunt.initConfig({
    // Display possible problems in your JS code.
    // -------------------------------------------------------------------------
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: [
        'assets/js/*.js'
      ]
    },

    // Process CSS.
    // -------------------------------------------------------------------------
    sass: {
      options: {
        sassDir:        cfg.cssCwd,
        imagePath: 'img',
        sourceMap: true,
        outputStyle:    'compressed'
      },

      prod: {
        files: [{
          expand: true,
          cwd:    cfg.cssCwd,
          src:    '**/*.scss',
          dest:   'css',
          ext:    '.min.css'
        }]
      },

      lab: {
        options: {
          outputStyle: 'expanded'
        },

        files: [{
          expand: true,
          cwd:    cfg.cssCwd,
          src:    '**/*.scss',
          dest:   'css',
          ext:    '.css'
        }]
      }
    },

    // Minify JS.
    // -------------------------------------------------------------------------
    uglify: {
      options: {
        sourceMap: true
      },

      // Concatenate and minify all files in cfg.jsCwd/all.
      concat: {
        files: {
          'js/all.min.js': [cfg.jsCwd + '/all/jquery.min.js', cfg.jsCwd + '/all/*.js'],
        }
      },

      // Minify in distinct files all files at the root of cfg.jsCwd.
      minify: {
        files: [{
          expand: true,
          cwd:    cfg.jsCwd,
          src:    '*.js',
          dest:   'js',
          ext:    '.min.js'
        }]
      }
    },

    // Watch for file changes and run tasks.
    // -------------------------------------------------------------------------
    watch: {
      sass: {
        files: [
          cfg.cssCwd + '/**/*.scss',
        ],
        tasks: ['sass:prod']
      },

      js: {
        files: [
          cfg.jsCwd + '/**/*.js',
        ],
        tasks: ['uglify:concat', 'uglify:minify']
      }
    }
  });

  // Load tasks
  // ===========================================================================
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-sass');

  // Register tasks
  // No default: you should know what you're doing.
  // ===========================================================================
  grunt.registerTask('lab', [
    'sass:lab',
    'uglify:concat',
    'uglify:minify'
  ]);

  grunt.registerTask('prod', [
    'sass:prod',
    'uglify:concat',
    'uglify:minify'
  ]);
};
