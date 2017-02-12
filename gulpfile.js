var gulp = require('gulp'),
    concat = require('gulp-concat-util'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    less = require('gulp-less'),

    browserSync = require('browser-sync').create(),
    modRewrite = require('connect-modrewrite'),

    gsi = require('gulp-scripts-index'),

    argv = require('yargs').argv,

    htmlmin = require('gulp-htmlmin'),

    // A stylesheet, javascript and webcomponent reference injection plugin for gulp. No more manual editing of your index.html!
    inject = require('gulp-inject'),

    cleanCSS = require('gulp-clean-css'),
    gulpSequence = require('gulp-sequence'),
    sourcemaps = require('gulp-sourcemaps'),

    // Static asset revision by appending content hash to file names unicorn.css → unicorn-098f6bcd.css
    rev = require('gulp-rev'),

    // Wrap all code in file to IIFE for clear global scope
    iife = require('gulp-iife'),

    // Prevent pipe breaking caused by errors from gulp plugins.
    plumber = require('gulp-plumber'),
    path = require('path'),
    clean = require('gulp-clean'),
    util = require('gulp-util');

gulp.task('clean:all', function () {
    return gulp
        .src([
            'dist/css/',
            'dist/js/',
            'index.html'
        ], { read: false })
        .pipe(clean());
});

// Поскольку в исходниках у нас *.less файлы
// даже для разработчика необходимо их собирать в *.css
// Собирается в один файл /dist/styles.css
// Все соединенные кусочки файлов имеют перед кодом имя файла исходника
gulp.task('css', function () {
    return gulp
        .src([
            'src/less/*.less'
        ])
        .pipe(plumber())
        .pipe(less({
            paths: [ path.join(__dirname) ]
        }))
        .pipe(concat('styles.css', {
            process: function(src) {
                // Все соединенные кусочки файлов имеют перед кодом имя файла исходника
                return '\n' + '/* Source: ' + path.basename(this.path) + ' */\n' + (src.trim() + '\n').replace(/(^|\n)[ \t]*('use strict'|"use strict");?\s*/g, '$1');
            }
        }))
        .pipe(sourcemaps.write('./'))
        .pipe(plumber.stop())
        .pipe(gulp.dest('dist/css/'));
});

// для продакшена
// Стили собираем в minify файл с ревизией в названии файла
gulp.task('css:minify', ['css'], function () {
    return gulp
        .src([
            'dist/css/styles.css'
        ])
        .pipe(plumber())
        .pipe(sourcemaps.init())
        .pipe(cleanCSS({
            keepSpecialComments: 0
        }))
        .pipe(rev())
        .pipe(rename({
            suffix: '.min'
        }))
        .pipe(sourcemaps.write('./'))
        .pipe(plumber.stop())
        .pipe(gulp.dest('dist/css/'));
});

// Скрипты собираем только для продакшена или тестового сервера
gulp.task('scripts', function () {
    return gulp
        .src([
            'src/**/*.js'
        ])
        .pipe(plumber())
        .pipe(sourcemaps.init())
        .pipe(iife())
        .pipe(concat('scripts.js'))
        .pipe(gulp.dest('dist/js/'))
        .pipe(uglify())
        .pipe(rev())
        .pipe(rename({
            suffix: '.min'
        }))
        .pipe(sourcemaps.write('./'))
        .pipe(plumber.stop())
        .pipe(gulp.dest('dist/js/'));
});


// Инъектирование исходников для отладки при разработке
gulp.task('index:all-src', function () {
    return gulp
        .src('src/index.html')
        .pipe(plumber())
        .pipe(inject(
            gulp
                .src('src/**/*.js')
                // .pipe(angularFilesort())
        ))
        .pipe(inject(
            gulp
                .src('dist/css/*.css', { read: false })
        ))
        .pipe(plumber.stop())
        .pipe(gulp.dest('./'));
});

// Инъектирование собранных файлов с ревизией
gulp.task('index:merged-min', ['css:minify', 'scripts'], function () {
    return gulp
        .src('src/index.html')
        .pipe(plumber())
        .pipe(inject(gulp.src(
            [
                'dist/js/*.min.js',
                'dist/css/*.min.css'
            ], {
                read: false
            }
        )))
        .pipe(plumber.stop())
        .pipe(gulp.dest('./'));
});

// Это задача обертка для запуска задачи `serve`
gulp.task('index:all-src-with-css', gulpSequence('clean:all', 'css', 'index:all-src'));

// Запуск lite-server'a
gulp.task('server', function () {
    browserSync.init({
        startPath: '/index.html',
        server: {
            baseDir: "./",
            middleware: [
                modRewrite([
                    '!\\.\\w+$ /index.html [L]'
                ])
            ]
        }
    });
});

// ++==================================++
// || Основная задача для разработчика ||
// ++==================================++
gulp.task('serve', ['index:all-src-with-css'], function () {

    browserSync.init({
        startPath: '/index.html',
        // host: 'app.itasks.dev',
        open: 'external',
        server: {
            baseDir: "./",
            middleware: [
                modRewrite([
                    '!\\.\\w+$ /index.html [L]'
                ])
            ],
        }
    });

    gulp.watch('src/**/*.less', ['css']);

    // отслеживаем изменения для инъектирования и сборки
    // индекс файла /index.html
    gulp.watch([
        'src/**/*.js',
        'src/**/*.html',
        'dist/css/*.css'
    ], function(event) {
        util.log(event.type, 'file:', event.path);

        // Тут вот что получается:
        // Инъектировать файлы в index.html нужно только при добавлении/удалении .js файлов
        // Также, если изменяется файл index.html запускаем задачу тоже
        if (/\/src\/index\.html$/.test(event.path)
            || event.type === 'added'
            || event.type === 'deleted'
        ) {
            // Логируем на всякий, что к чему
            util.log('INJECTOR', event.type, 'file:', event.path);

            // запускаем инъектирование /src/*.js, /dist/*.css и создаем /index.html
            gulp.start('index:all-src', function (err) {
                if (err) return;
                if (!argv.withoutWatch) {
                    browserSync.reload(event);
                }
            });
        } else {
            if (!argv.withoutWatch) {
                browserSync.reload(event)
            }
        }
    });


});

// ++=================================++
// || Основная задача для dev сервера ||
// ++=================================++
gulp.task('dev', ['index:all-src-with-css']);

// ++===================================================++
// || Основная и дефолтная задача для rc и prod сервера ||
// ++===================================================++
gulp.task('default', gulpSequence('clean:all', 'index:merged-min'));