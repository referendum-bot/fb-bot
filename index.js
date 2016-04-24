'use strict';

console.log('Starting app');

// Messenger API integration example
// We assume you have:
// * a Wit.ai bot setup (https://wit.ai/docs/quickstart)
// * a Messenger Platform setup (https://developers.facebook.com/docs/messenger-platform/quickstart)
// You need to `npm install` the following dependencies: body-parser, express, request.
//
// 1. npm install body-parser express request 
// 2. Download and install ngrok from https://ngrok.com/download
// 3. ./ngrok http 8445
// 4. WIT_TOKEN=your_access_token FB_PAGE_ID=your_page_id FB_PAGE_TOKEN=your_page_token FB_VERIFY_TOKEN=verify_token node examples/messenger.js
// 5. Subscribe your page to the Webhooks using verify_token and `https://<your_ngrok_io>/fb` as callback URL.
// 6. Talk to your bot on Messenger!

const bodyParser = require('body-parser');
const express = require('express');
const request = require('request');

// When not cloning the `node-wit` repo, replace the `require` like so:
const Wit = require('node-wit').Wit;
//const Wit = require('../').Wit;

// Webserver parameter
const PORT = process.env.PORT || 8445;

// Wit.ai parameters
const WIT_TOKEN = process.env.WIT_TOKEN;

// Messenger API parameters
const FB_PAGE_ID = process.env.FB_PAGE_ID && Number(process.env.FB_PAGE_ID);
if (!FB_PAGE_ID) {
  throw new Error('missing FB_PAGE_ID');
}
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
if (!FB_PAGE_TOKEN) {
  throw new Error('missing FB_PAGE_TOKEN');
}
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;

var localsessions = {};
// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference
const fbReq = request.defaults({
  uri: 'https://graph.facebook.com/me/messages',
  method: 'POST',
  qs: { access_token: FB_PAGE_TOKEN },
  headers: {'Content-Type': 'application/json'},
});

const fbMessage = function (recipientId, msg, cb) {
  var message;
  try
  {
    message = JSON.parse(msg);
  }
  catch(e)
  {
    message = {text: msg}
  };
  
  console.log('message is ', message);
  
  request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:FB_PAGE_TOKEN},
        method: 'POST',
        json: {
            recipient: {id:recipientId},
            message: message,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
    });
  
  
  ///
  const opts = {
    json:{
      recipient: {id: recipientId},
      message: msg
    }
  };
  fbReq(opts, (err, resp, data) => {
    if (cb) {
      cb(err || data.error && data.error.message, data);
    }
  });
};

// See the Webhook reference
// https://developers.facebook.com/docs/messenger-platform/webhook-reference
const getFirstMessagingEntry = (body) => {
  const val = body.object == 'page' &&
    body.entry &&
    Array.isArray(body.entry) &&
    body.entry.length > 0 &&
    body.entry[0] &&
    body.entry[0].id == FB_PAGE_ID &&
    body.entry[0].messaging &&
    Array.isArray(body.entry[0].messaging) &&
    body.entry[0].messaging.length > 0 &&
    body.entry[0].messaging[0]
  ;
  return val || null;
};

// Wit.ai bot specific code

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};

const findOrCreateSession = (fbid) => {
  let sessionId;
  // Let's see if we already have a session for the user fbid
  Object.keys(sessions).forEach(k => {
    if (sessions[k].fbid === fbid) {
      // Yep, got it!
      sessionId = k;
    }
  });
  if (!sessionId) {
    // No session found for user fbid, let's create a new one
    sessionId = new Date().toISOString();
    sessions[sessionId] = {fbid: fbid, context: {}};
  }
  return sessionId;
};

// Our bot actions
const actions = {
  say(sessionId, context, message, cb) {
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
    const recipientId = sessions[sessionId].fbid;
    if (recipientId) {
      // Yay, we found our recipient!
      // Let's forward our bot response to her.
      fbMessage(recipientId, message, (err, data) => {
        if (err) {
          console.log(
            'Oops! An error occurred while forwarding the response to',
            recipientId,
            ':',
            err
          );
        }

        // Let's give the wheel back to our bot
        cb();
      });
    } else {
      console.log('Oops! Couldn\'t find user for session:', sessionId);
      // Giving the wheel back to our bot
      cb();
    }
  },
  ['sayTemplate'](sessionId, context, cb) {
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
    const recipientId = sessions[sessionId].fbid;
    
    if(!context.intents) {
      // TODO: say some error message 
      console.err('There was no template... oh no!', context);
    } else {
      var message = generateEconomyMessage();
      
      fbMessage(recipientId, message, (err, data) => {
        if (err) {
          console.log(
            'Oops! An error occurred while forwarding the response to',
            recipientId,
            ':',
            err
          );
        }

        // Let's give the wheel back to our bot
        cb();
      });
      
      cb(context);
    }
  },
  merge(sessionId, context, entities, message, cb) {
    // TODO: do we really need to delete everything?
    delete context.joke;
    delete context.question;
    delete context.name;
    delete context.entities; 
    
    context.intents = entities.intent;
    console.log('intents', context.intents);

    cb(context);
  },
  error(sessionId, context, error) {
    console.log(error.message);
  },
  ['joke'](sessionId, context, cb) {
    request('http://tambal.azurewebsites.net/joke/random', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body);
            var jokeObj = JSON.parse(body);
            context.joke = jokeObj['joke'];
            cb(context);
         } else {
          context.joke = "No joke found?";
          cb(context);
        }
    });

  },
  ['represent-question'](sessionId, context, cb) {
    console.log("requesting a question");
      if (localsessions[sessionId] == undefined){
          localsessions[sessionId]  = {};
      }
    var ses = localsessions[sessionId];
    if (ses.answered_questions == undefined) {
        ses.answered_questions = [];
    };
      var qj = JSON.stringify(ses.answered_questions);
      var idstring = qj.substring(1, qj.length-1);
      if (idstring == "")idstring = "0";
      idstring = "&id__in!="+idstring;
      console.log(idstring);

      console.log('https://represent.me/api/next_question/?subtype=likert&tags__tag__text=EUreferendum'+idstring);
    //note: we can use `&id__in!=45,22,94` to avoid being re-asked the same question
    request('https://represent.me/api/next_question/?subtype=likert&tags__tag__text=EUreferendum'+idstring, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body);
            var dataObj = JSON.parse(body);
            //get the first question
            var q = dataObj['results'][0];
            if (q) {

                ses.answered_questions.push(q.id);
                context.question = q['question'];
                console.log("got question:", context.question);
            } else {
                context.question = "No questions left! Go and vote :)"
            }
            cb(context);
         } else {
          context.question = "No question returned? perhaps you answered them all...";
          cb(context);
        }
    });

  },
  ['get-name'](sessionId, context, cb) {
    console.log('Getting user info');
    var userId = sessions[sessionId].fbid;
    request('https://graph.facebook.com/v2.6/' + userId + '?fields=first_name,last_name,profile_pic&access_token=' + FB_PAGE_TOKEN, function(error, response, body) {
         if (!error && response.statusCode == 200) {
            console.log(body);
            var dataObj = JSON.parse(body);
            //just get the main part of the question for the mo
            context.name = dataObj.first_name;
            console.log("got name:", context.name);
            cb(context);
         } else {
          context.question = "Error getting user data from the FB api";
          cb(context);
        }
    });
  }
  // You should implement your custom actions here
  // See https://wit.ai/docs/quickstart
};

// Setting up our bot
const wit = new Wit(WIT_TOKEN, actions);

// Starting our webserver and putting it all together
const app = express();
app.set('port', PORT);
app.listen(app.get('port'));
app.use(bodyParser.json());

// Webhook setup
app.get('/fb', (req, res) => {
  if (!FB_VERIFY_TOKEN) {
    throw new Error('missing FB_VERIFY_TOKEN');
  }
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

// Message handler
app.post('/fb', (req, res) => {
  // Parsing the Messenger API response
  
  const messaging = getFirstMessagingEntry(req.body);
  
  console.log(messaging);
  if (messaging && messaging.message && messaging.recipient.id === FB_PAGE_ID) {
    // Yay! We got a new message!

    // We retrieve the Facebook user ID of the sender
    const sender = messaging.sender.id;

    // We retrieve the user's current session, or create one if it doesn't exist
    // This is needed for our bot to figure out the conversation history
    const sessionId = findOrCreateSession(sender);

    // We retrieve the message content
    const msg = messaging.message.text;
    const atts = messaging.message.attachments;

    if (atts) {
      // We received an attachment

      // Let's reply with an automatic message
      fbMessage(
        sender,
        'Sorry I can only process text messages for now.'
      );
    } else if (msg) {
      // We received a text message
      
      // Let's forward the message to the Wit.ai Bot Engine
      // This will run all actions until our bot has nothing left to do
      wit.runActions(
        sessionId, // the user's current session
        msg, // the user's message 
        sessions[sessionId].context, // the user's current session state
        (error, context) => {
          if (error) {
            console.log('Oops! Got an error from Wit:', error);
          } else {
            // Our bot did everything it has to do.
            // Now it's waiting for further messages to proceed.
            console.log('Waiting for futher messages.');

            // Based on the session state, you might want to reset the session.
            // This depends heavily on the business logic of your bot.
            // Example:
            // if (context['done']) {
            //   delete sessions[sessionId];
            // }

            // Updating the user's current session state
            sessions[sessionId].context = context;
          }
        }
      );
    }
  }
  res.sendStatus(200);
});

function generateEconomyMessage() {
    var messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": [{
                    "title": "Would leaving the EU cost or benefit the UK economy?",
                    "subtitle": "The £4,300 question: would leaving the EU really make every household worse off? According to new Treasury research, it would cost us.",
                    "image_url": "https://4csjs540i3sl474btf1qhbrq-wpengine.netdna-ssl.com/wp-content/themes/eureferendum/assets/img/box-quiz.jpg",
                    "buttons": [{
                        "type": "web_url",
                        "url": "https://fullfact.org/europe/4300-question-would-leaving-eu-really-make-every-household-worse/",
                        "title": "Go to Full Fact."
                    }, {
                        "type": "postback",
                        "title": "Read a summary",
                        "payload": "Payload for reading summary",
                    }],
                }, {
                    "title": "Question 1",
                    "subtitle": "Tell me if you agree or disagree.",
                    "image_url": "https://4csjs540i3sl474btf1qhbrq-wpengine.netdna-ssl.com/wp-content/themes/eureferendum/assets/img/box-quiz.jpg",
                    "buttons": [
                    	{
                        "type": "postback",
                        "title": "Agree",
                        "payload": "Payload - result for agree"
                    },
                    {
                    	"type": "postback",
                        "title": "Neither agree or disagree",
                        "payload": "Payload - result for neither agree of disagree"
                    },
                    {
                    	"type": "postback",
                        "title": "Disagree",
                        "payload": "Payload - result for disagree",
                    }],
                }]
            }
        }
    };
    
    return messageData; 
}
