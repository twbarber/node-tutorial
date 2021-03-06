var express = require('express');
var fortune = require('./lib/fortune.js');
var weather = require('./lib/weather.js');
var formidable = require('formidable');
var jqupload = require('jquery-file-upload-middleware');
var credentials = require('./credentials.js');

var app = express();

// set up handlebars view engine
var handlebars = require('express3-handlebars')
    .create({
        defaultLayout: 'main',
        helpers: {
            section: function(name, options) {
                if (!this._sections) this._sections = {};
                this._sections[name] = options.fn(this);
                return null;
            }
        }
    });
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

app.set('port', process.env.PORT || 3000);

app.use(function(req, res, next) {
    res.locals.showTests = app.get('env') !== 'production' &&
        req.query.test === '1';
    next();
});
app.use(function(req, res, next) {
    if (!res.locals.partials) res.locals.partials = {};
    res.locals.partials.weather = weather.getWeatherData();
    next();
});
app.use(express.static(__dirname + '/public'));
app.use(require('body-parser')());
app.use(require('cookie-parser')(credentials.cookieSecret));
app.use(require('express-session')());

app.use(function(req, res, next) {
    console.log('order matters');
    next();
});

app.use(function(req, res, next) {
    console.log('processing request for "' + req.url + '"....');
    next();
});

app.use(function(req, res, next) {
    console.log('terminating request');
    res.send('thanks for playing!');
    // note that we do NOT call next() here...this terminates the request
});

app.use(function(req, res, next) {
    console.log('whoops, i\'ll never get called!');
});

// Default Routes
app.get('/headers', function(req, res) {
    res.set('Content-Type', 'text/plain');
    var s = '';
    for (var name in req.headers) s += name + ': ' + req.headers[name] + '\n';
    res.send(s);
});

app.get('/', function(req, res) {
    res.cookie('monster', 'nom nom');
    res.cookie('signed_monster', 'nom nom', {
        signed: true
    });
    res.render('home');
});

app.get('/about', function(req, res) {
    var monster = req.cookies.monster;
    var signedMonster = req.signedCookies.monster;
    res.render('about', {
        fortune: fortune.getFortune(),
        pageTestScript: '/qa/tests-about.js'
    });
});

// Newsletter Routes
app.get('/newsletter', function(req, res) {
    // we will learn about CSRF later...for now, we just
    // provide a dummy value
    res.render('newsletter', {
        csrf: 'CSRF token goes here'
    });
});

app.post('/process', function(req, res) {
    if (req.xhr || req.accepts('json,html') === 'json') {
        // if there were an error, we would send { error: 'error description' }
        res.send({
            success: true
        });
    } else {
        // if there were an error, we would redirect to an error page
        res.redirect(303, '/thank-you');
    }
});

// Vactation Photo Routes
app.get('/contest/vacation-photo', function(req, res) {
    var now = new Date();
    res.render('contest/vacation-photo', {
        year: now.getFullYear(),
        month: now.getMonth(),
    });
});

app.post('/contest/vacation-photo/:year/:month', function(req, res) {
    var form = new formidable.IncomingForm();
    console.log('request params:');
    console.log(req.params);
    form.parse(req, function(err, fields, files) {
        if (err) return res.redirect(303, '/error');
        console.log('received fields:');
        console.log(fields);
        console.log('received files:');
        console.log(files);
        res.redirect(303, '/thank-you');
    });
});

app.use('/upload', function(req, res, next) {
    var now = Date.now();
    jqupload.fileHandler({
        uploadDir: function() {
            return __dirname + '/public/uploads/' + now;
        },
        uploadUrl: function() {
            return '/uploads/' + now;
        },
    })(req, res, next);
});

// Tour Routes
app.get('/tours/hood-river', function(req, res) {
    res.render('tours/hood-river');
});

app.get('/tours/oregon-coast', function(req, res) {
    res.render('tours/oregon-coast');
});

app.get('/tours/request-group-rate', function(req, res) {
    res.render('tours/request-group-rate');
});

// Newsletter Routes
app.post('/newsletter', function(req, res) {
    var name = req.body.name || '',
        email = req.body.email || '';
    // input validation
    if (!email.match(VALID_EMAIL_REGEX)) {
        if (req.xhr) return res.json({
            error: 'Invalid name email address.'
        });
        req.session.flash = {
            type: 'danger',
            intro: 'Validation error!',
            message: 'The email address you entered was not valid.',
        };
        return res.redirect(303, '/newsletter/archive');
    }
    new NewsletterSignup({
        name: name,
        email: email
    }).save(function(err) {
        if (err) {
            if (req.xhr) return res.json({
                error: 'Database error.'
            });
            req.session.flash = {
                type: 'danger',
                intro: 'Database error!',
                message: 'There was a database error; please try again later.',
            };
            return res.redirect(303, '/newsletter/archive');
        }
        if (req.xhr) return res.json({
            success: true
        });
        req.session.flash = {
            type: 'success',
            intro: 'Thank you!',
            message: 'You have now been signed up for the newsletter.',
        };
        return res.redirect(303, '/newsletter/archive');
    });
});

// Nursery Rhyme Routes
app.get('/nursery-rhyme', function(req, res) {
    res.render('nursery-rhyme');
});
app.get('/data/nursery-rhyme', function(req, res) {
    res.json({
        animal: 'squirrel',
        bodyPart: 'tail',
        adjective: 'bushy',
        noun: 'heck',
    });
});

// 404 catch-all handler (middleware)
app.use(function(req, res, next) {
    res.status(404);
    res.render('404');
});

// 500 error handler (middleware)
app.use(function(err, req, res, next) {
    console.error(err.stack);
    res.status(500);
    res.render('500');
});

app.listen(app.get('port'), function() {
    console.log('Express started on http://localhost:' +
        app.get('port') + '; press Ctrl-C to terminate.');
});
