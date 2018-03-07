const gulp = require('gulp');
const util = require('gulp-util')
const gulpConnect = require('gulp-connect');
const connect = require('connect');
const cors = require('cors');
const path = require('path');
const exec = require('child_process').exec;
const portfinder = require('portfinder');
const swaggerRepo = require('swagger-repo');

const DIST_DIR = 'web_deploy';

gulp.task('serve', ['build', 'watch', 'edit'], function() {
  portfinder.getPort({port: 3000}, function (err, port) {
    gulpConnect.server({
      root: [DIST_DIR],
      livereload: true,
      port: port,
      middleware: function (gulpConnect, opt) {
        return [
          cors()
        ]
      }
    });
  });
});

gulp.task('edit', function() {
  portfinder.getPort({port: 5000}, function (err, port) {
    var app = connect();
    app.use(swaggerRepo.swaggerEditorMiddleware());
    app.listen(port);
    util.log(util.colors.green('swagger-editor started http://localhost:' + port));
  });
});

gulp.task('build', function (cb) {
  exec('npm run build', function (err, stdout, stderr) {
    console.log(stderr);
    cb(err);
  });
});

gulp.task('reload', ['build'], function () {
  gulp.src(DIST_DIR).pipe(gulpConnect.reload())
});

gulp.task('watch', function () {
  gulp.watch(['spec/**/*', 'web/**/*'], ['reload']);
});
