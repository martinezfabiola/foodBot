// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// const { ActivityTypes } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');

const { ChoicePrompt, DialogSet, NumberPrompt, TextPrompt, WaterfallDialog, DialogTurnStatus } = require('botbuilder-dialogs');

const { ActionTypes, ActivityTypes, CardFactory, BotFrameworkAdapter, MessageFactory } = require('botbuilder');

const DIALOG_STATE_PROPERTY = 'dialogState';
const USER_PROFILE_PROPERTY = 'user';
const RESTAURANT_PROPERTY = 'restaurant';

//const WHICH_KIND_OF_FOOD = 'which_kind_of_food';
//const KIND_OF_FOOD = 'kind_of_food';
const WHICH_NAME = 'which_name';
const WHICH_FOOD = 'which_food';
const WHICH_PRICE = 'which_price';
const WHICH_LOCALISATION = 'which_localisation';
const END_OF_DIALOG = 'end_of_dialog';

const NAME_PROMPT = 'name_prompt';
const CONFIRM_PROMPT = 'confirm_prompt';
//const AGE_PROMPT = 'age_prompt';
const FOOD_PROMPT = 'food_prompt';
const CONFIRM_LOCALISATION_PROMPT = 'confirm_localisation_prompt';
const LOCALISATION_PROMPT = 'localisation_prompt';

var user = [];


/**
 * A simple bot that responds to utterances with answers from the Language Understanding (LUIS) service.
 * If an answer is not found for an utterance, the bot responds with help.
 */
class LuisBot {
    /**
     * The LuisBot constructor requires one argument (`application`) which is used to create an instance of `LuisRecognizer`.
     * @param {LuisApplication} luisApplication The basic configuration needed to call LUIS. In this sample the configuration is retrieved from the .bot file.
     * @param {LuisPredictionOptions} luisPredictionOptions (Optional) Contains additional settings for configuring calls to LUIS.
     */
    constructor(application, luisPredictionOptions, conversationState, userState) {

        this.luisRecognizer = new LuisRecognizer(application, luisPredictionOptions, true);

        // Create a new state accessor property. See https://aka.ms/about-bot-state-accessors to learn more about bot state and state accessors.
        this.conversationState = conversationState;
        this.userState = userState;

        this.dialogState = this.conversationState.createProperty(DIALOG_STATE_PROPERTY);

        this.userProfile = this.userState.createProperty(USER_PROFILE_PROPERTY);

        this.dialogs = new DialogSet(this.dialogState);

        // Add prompts that will be used by the main dialogs.
        this.dialogs.add(new TextPrompt(NAME_PROMPT));
        this.dialogs.add(new ChoicePrompt(CONFIRM_PROMPT));
        this.dialogs.add(new TextPrompt(FOOD_PROMPT));
        this.dialogs.add(new ChoicePrompt(CONFIRM_LOCALISATION_PROMPT));
        this.dialogs.add(new TextPrompt(LOCALISATION_PROMPT));

        // Create a dialog that asks the user for their name.
        this.dialogs.add(new WaterfallDialog(WHICH_NAME, [
            this.promptForName.bind(this),
            this.confirmNamePrompt.bind(this),
        ]));

        // Create a dialog that asks the user for the food he wants to eat
        this.dialogs.add(new WaterfallDialog(WHICH_FOOD, [
            this.confirmFoodPrompt.bind(this),
            this.promptForFood.bind(this),
            this.captureFood.bind(this),
            this.displayFoodChoice.bind(this)
        ]));

        // Create a dialog that asks the user for which price he wants to eat
        this.dialogs.add(new WaterfallDialog(WHICH_PRICE, [
            this.capturePrice.bind(this),
            this.displayPriceChoice.bind(this)
        ]));

        // Create a dialog that asks the user for where he wants to eat
        this.dialogs.add(new WaterfallDialog(WHICH_LOCALISATION, [
          this.confirmLocalisationPrompt.bind(this),
          this.promptForLocalisation.bind(this),
          this.captureLocalisation.bind(this),
          this.displayLocalisationChoice.bind(this)
        ]));

        // Create a dialog that displays a user name after it has been collected.
        this.dialogs.add(new WaterfallDialog(END_OF_DIALOG, [
          this.displayProfile.bind(this)
        ]));
    }

    /**
     * Every conversation turn calls this method.
     * There are no dialogs used, since it's "single turn" processing, meaning a single request and
     * response, with no stateful conversation.
     * @param {TurnContext} turnContext A TurnContext instance, containing all the data needed for processing the conversation turn.
     */
     async onTurn(turnContext) {
     if (turnContext.activity.type === ActivityTypes.Message) {
         // Create a dialog context object.
         const dc = await this.dialogs.createContext(turnContext);

         const utterance = (turnContext.activity.text || '').trim().toLowerCase();

         // ...
         // If the bot has not yet responded, continue processing the current dialog.
         await dc.continueDialog();

         // Start the sample dialog in response to any other input.
         if (!turnContext.responded) {
             const user = await this.userProfile.get(dc.context, {});
             if (!user.name) { // si l'utilisateur n'a pas de nom alors le dialogue commence par lui demander son nom
                 await dc.beginDialog(WHICH_NAME);
             } else { // sinon le premier dialogue est pour lui demander quel genre de food il veut
                 await dc.beginDialog(END_OF_DIALOG);
             }

         }
     } else if (turnContext.activity.type === ActivityTypes.ConversationUpdate &&
         turnContext.activity.recipient.id !== turnContext.activity.membersAdded[0].id) {
         // If the Activity is a ConversationUpdate, send a greeting message to the user.
         await turnContext.sendActivity('Welcome to our FoodBot 🤖! Send me a message and I will try to predict your intent to find a restaurant. Say Hi! 👋🏻');
     }

     // ...
     // Save changes to the user state.
     await this.userState.saveChanges(turnContext);

     // End this turn by saving changes to the conversation state.
     await this.conversationState.saveChanges(turnContext);
 }


/***********************************************************************************************************************/
/***********************************************************************************************************************/

/**
  * This step in the dialog prompts the user for their name.
  * @param step A step instance, containing all the data needed for processing the conversation turn.
  */
async promptForName(step) {
  return await step.prompt(NAME_PROMPT, `What is your name, human?`);
}

/**
  * This step in the dialog prompts the user for their name.
  * @param step A step instance, containing all the data needed for processing the conversation turn.
  */
async confirmNamePrompt(step) {
  const user = await this.userProfile.get(step.context, {});
  user.name = step.result;
  await this.userProfile.set(step.context, user);

    return await step.beginDialog(WHICH_FOOD);
}

/**
  * This step in the dialog shows options for knows if the user knows what want to eat
  * @param step A step instance, containing all the data needed for processing the conversation turn.
  */
async confirmFoodPrompt(step) {
    const user = await this.userProfile.get(step.context, {});
    await step.prompt(CONFIRM_PROMPT, `Hey ${ user.name } 🙂! Do you know what you want to eat ?`, ['yes', 'no']);
}

/**
  * This step checks the user's response - if yes, the bot will proceed to do other questions.
  * Otherwise retry
  * @param step A step instance, containing all the data needed for processing the conversation turn.
  */
async promptForFood(step) {
    if (step.result && step.result.value === 'yes') {

      return await step.prompt(FOOD_PROMPT, `Tell me what kind of food would you prefer ?`,
      {
        retryPrompt: 'Sorry, I do not understand or say cancel.'
      }
      );
    } else {
        return await step.next(-1);
    }
}

/**
  * This step checks the user's response about what kind of food wants with LUIS
  * @param step A step instance, containing all the data needed for processing the conversation turn.
  */
async captureFood(step) {
    const user = await this.userProfile.get(step.context, {});

    // Perform a call to LUIS to retrieve results for the user's message.
    const results = await this.luisRecognizer.recognize(step.context);

    // Since the LuisRecognizer was configured to include the raw results, get the `topScoringIntent` as specified by LUIS.
    const topIntent = results.luisResult.topScoringIntent;
    const topEntity = results.luisResult.entities[0];

    if (step.result !== -1) {

        if (topIntent.intent == 'ChooseTypeOfFood') {
          user.food = topEntity.entity;
          await this.userProfile.set(step.context, user);

          //await step.context.sendActivity(`Entity: ${topEntity.entity}`);
          await step.context.sendActivity(`I'm going to find the restaurant to eat : ${topEntity.entity}`);
          //return await step.next();
        }
        else {
          await this.userProfile.set(step.context, user);
          await step.context.sendActivity(`Sorry, I do not understand or say cancel.`);
          return await step.replaceDialog(WHICH_FOOD);
        }

        // await step.context.sendActivity(`I will remember that you want this kind of food :  ${ step.result } `);
    } else {// si l'user ne sait pas quelle genre de food il veut

            const { ActionTypes, ActivityTypes, CardFactory } = require('botbuilder');

            const reply = { type: ActivityTypes.Message };

            // // build buttons to display.
            const buttons = [
            { type: ActionTypes.ImBack, title: '1. European 🍝 🍲', value: '1' },
            { type: ActionTypes.ImBack, title: '2. Chinese 🍜 🍚', value: '2' },
            { type: ActionTypes.ImBack, title: '3. American 🍔 🍟', value: '3' }
            ];

            // // construct hero card.
            const card = CardFactory.heroCard('', undefined,
            buttons, { text: 'What type of restaurant do you want ?' });

            // // add card to Activity.
            reply.attachments = [card];

            // // Send hero card to the user.
            await step.context.sendActivity(reply);

        }
        //return await step.beginDialog(WHICH_PRICE);
    //return await step.endDialog();
}


/**
  * This step shows food options for the user
  * @param step A step instance, containing all the data needed for processing the conversation turn.
  */
async displayFoodChoice(step) {
    const user = await this.userProfile.get(step.context, {});
    if (user.food) {
        await step.context.sendActivity(`Your name is ${ user.name } and you would like this kind of food : ${ user.food }.`);
    } else {
      const user = await this.userProfile.get(step.context, {});

      //await step.context.sendActivity(`[${ step.context.activity.text }]-type activity detected.`);

      if (step.context.activity.text == 1) {
        user.food = "European";
        await this.userProfile.set(step.context, user);
      }  else if (step.context.activity.text == 2) {
        user.food = "Chinese";
        await this.userProfile.set(step.context, user);
      } else if (step.context.activity.text == 3) {
        user.food = "American";
        await this.userProfile.set(step.context, user);
      }else {
        await this.userProfile.set(step.context, user);
        await step.context.sendActivity(`Sorry, I do not understand, please try again.`);
        return await step.beginDialog(WHICH_FOOD);
      }

      await step.context.sendActivity(`Your name is ${ user.name } and you would like this kind of food : ${ user.food }.`);
    }
    return await step.beginDialog(WHICH_PRICE);
    //return await step.endDialog();
}

/**
  * This step captures the food price the users wants
  * @param step A step instance, containing all the data needed for processing the conversation turn.
  */
async capturePrice(step) {
    const user = await this.userProfile.get(step.context, {});

    const { ActionTypes, ActivityTypes, CardFactory } = require('botbuilder');

    const reply = { type: ActivityTypes.Message };

    // // build buttons to display.
    const buttons = [
    { type: ActionTypes.ImBack, title: '1. 💰', value: '1' },
    { type: ActionTypes.ImBack, title: '2. 💰💰', value: '2' },
    { type: ActionTypes.ImBack, title: '3. I do not care', value: '3' }
    ];

    // // construct hero card.
    const card = CardFactory.heroCard('', undefined,
    buttons, { text: 'For how much do you want to eat ?' });

    // // add card to Activity.
    reply.attachments = [card];

    // // Send hero card to the user.
    await step.context.sendActivity(reply);
}

/**
  * This step shows the food price the users wants
  * @param step A step instance, containing all the data needed for processing the conversation turn.
  */
async displayPriceChoice(step) {
    const user = await this.userProfile.get(step.context, {});

    if (step.context.activity.text == 1) {
      user.price = "cheap";
      await this.userProfile.set(step.context, user);
    }  else if (step.context.activity.text == 2) {
      user.price = "expensive";
      await this.userProfile.set(step.context, user);
    } else if (step.context.activity.text == 3) {
      user.price = "";
      await this.userProfile.set(step.context, user);
    }else {
      await this.userProfile.set(step.context, user);
      await step.context.sendActivity(`Sorry, I do not understand, please try again.`);
      return await step.beginDialog(WHICH_PRICE);
    }

    await step.context.sendActivity(`${ user.name } you would like this kind of food : ${ user.food } and for a ${ user.price }`);

    return await step.beginDialog(WHICH_LOCALISATION);
}

/**
  * This step captures the restaurant's localisation, then prompts whether or not to collect a localisation.
  * @param step A step instance, containing all the data needed for processing the conversation turn.
  */
async confirmLocalisationPrompt(step) {

    await step.prompt(CONFIRM_LOCALISATION_PROMPT, 'Do you know where you want to eat ?', ['yes', 'no']);
}

/**
  * This step checks the user's response - if yes, the bot will proceed to prompt for localisation.
  * Otherwise, the bot will skip the localisation step.
  * @param step A step instance, containing all the data needed for processing the conversation turn.
  */
async promptForLocalisation(step) {
    if (step.result && step.result.value === 'yes') {
        return await step.prompt(LOCALISATION_PROMPT, `Tell me where would you prefer to eat 📍?`,
            {
                retryPrompt: 'Sorry, I do not understand or say cancel.'
            }
        );
    } else {
        return await step.next(-1);
    }
}

/**
  * This step captures the restaurant's localisation.
  * @param step A step instance, containing all the data needed for processing the conversation turn.
  */
async captureLocalisation(step) {
    const user = await this.userProfile.get(step.context, {});

    // Perform a call to LUIS to retrieve results for the user's message.
    const results = await this.luisRecognizer.recognize(step.context);

    // Since the LuisRecognizer was configured to include the raw results, get the `topScoringIntent` as specified by LUIS.
    const topIntent = results.luisResult.topScoringIntent;
    const topEntity = results.luisResult.entities[0];

    if (step.result !== -1) {

        if (topIntent.intent == 'FindLocalisation') {
            user.localisation = topEntity.entity;
            await this.userProfile.set(step.context, user);

            await step.context.sendActivity(`Entity: ${topEntity.entity}`);
            await step.context.sendActivity(`I'm going to find the restaurant at this localisation : ${topEntity.entity}`);
            //return await step.next();
        }
        else {
            //user.localisation = step.result;
            await this.userProfile.set(step.context, user);
            await step.context.sendActivity(`Sorry, I do not understand or say cancel.`);
            return await step.replaceDialog(WHICH_LOCALISATION);
        }

        // await step.context.sendActivity(`I will remember that you want this kind of food :  ${ step.result } `);
    } else {// si l'user ne sait pas quelle genre de food il veut

            const { ActionTypes, ActivityTypes, CardFactory } = require('botbuilder');

            const reply = { type: ActivityTypes.Message };

            // // build buttons to display.
            const buttons = [
            { type: ActionTypes.ImBack, title: '1. San Francisco', value: '1' },
            { type: ActionTypes.ImBack, title: '2. New York', value: '2' },
            { type: ActionTypes.ImBack, title: '3. Miami', value: '3' }
            ];

            // // construct hero card.
            const card = CardFactory.heroCard('', undefined,
            buttons, { text: 'Where do you want to eat 📍?' });

            // // add card to Activity.
            reply.attachments = [card];

            // // Send hero card to the user.
            await step.context.sendActivity(reply);

        }
        //return await step.beginDialog(WHICH_PRICE);
    //return await step.endDialog();
}

/**
  * This step displays the captured information back to the user.
  * @param step A step instance, containing all the data needed for processing the conversation turn.
  */
async displayLocalisationChoice(step) {
    
    const user = await this.userProfile.get(step.context, {});
    
    if (user.localisation) {

      await step.context.sendActivity(`${ user.name } you would like to eat : ${ user.food } where it's ${ user.localisation } from you`);
    
    } else {
      
      const user = await this.userProfile.get(step.context, {});

      //await step.context.sendActivity(`[${ step.context.activity.text }]-type activity detected.`);

      if (step.context.activity.text == 1) {
        user.localisation = "San Francisco";
        await this.userProfile.set(step.context, user);
      }  else if (step.context.activity.text == 2) {
        user.localisation = "New York";
        await this.userProfile.set(step.context, user);
      } else if (step.context.activity.text == 3) {
        user.localisation = "Miami";
        await this.userProfile.set(step.context, user);
      }else {
        await this.userProfile.set(step.context, user);
        await step.context.sendActivity(`Sorry, I do not understand, please try again.`);
        return await step.beginDialog(WHICH_LOCALISATION);
      }

      await step.context.sendActivity(`${ user.name } you would like to eat : ${ user.food } where it's located : ${ user.localisation }`);
      // console.log('user.food  1 = ' + `${ user.food }`);
      // console.log('user.localisation 2 = ' + user.localisation);
    }
    
    let mkt = 'en-US';
    //console.log('user.food  = ' + `${ user.food }` );
    //console.log('user.localisation = ' + user.localisation);
    let q = `${ user.food } restaurant ${ user.localisation } ${ user.price }`;
          
    // console.log('q = ' + q);

    let params = '?mkt=' + mkt + '&q=' + encodeURI(q);

    let request_params = {
       method : 'GET',
       hostname : host,
       path : path + params,
       headers : {
        'Ocp-Apim-Subscription-Key' : subscriptionKey,
       }
    };

    let req = https.request (request_params, response_handler);
    req.end ();

    await someTimeConsumingThing();

    return await step.replaceDialog(END_OF_DIALOG);
}

// This step displays the captured information back to the user.
async displayProfile(step) {
  
  const user = await this.userProfile.get(step.context, {});

  // Send adaptive card.
  //await step.context.sendActivity({
  //      text: 'Here is an Adaptive Card:',
  //       attachments: [CardFactory.adaptiveCard(CARDS)]
  //});

  if(dataName.length >= 3){

    const CARD_UN = {
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "type": "AdaptiveCard",
  "version": "1.0",
  "body": [
     {
       "speak": "Tom's Pie is a Pizza restaurant which is rated 9.3 by customers.",
       "type": "ColumnSet",
       "columns": [
         {
           "type": "Column",
           "width": 2,
           "items": [
             {
               "type": "TextBlock",
               "text": `${user.food}`
             },
             {
               "type": "TextBlock",
               "text": `${dataName[0].name}`,
               "weight": "bolder",
               "size": "extraLarge",
               "spacing": "none"
             },
             {
               "type": "TextBlock",
               "text": `${dataName[0].telephone}`,
               "isSubtle": true,
               "spacing": "none"
             },
             {
               "type": "TextBlock",
               "text": `${dataName[0].address.neighborhood}`,
               "size": "small",
               "spacing": "none"
             },
             {
               "type": "TextBlock",
               "text": `${dataName[0].address.postalCode} ${dataName[0].address.addressLocality} ${dataName[0].address.addressRegion}`,
               "size": "small",
               "wrap": true
             }
           ]
         },
         {
           "type": "Column",
           "width": 1,
           "items": [
             {
               "type": "Image",
               "url": "/Users/fabiolamartinez/foodBot/logo.png",
               "size": "auto"
             }
           ]
         }
       ]
     }
   ],
   "actions": [
     {
       "type": "Action.OpenUrl",
       "title": "More Info",
       "url": `${dataName[0].url}`
     }
   ]
  };

  const CARD_DEUX = {
    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
 "type": "AdaptiveCard",
 "version": "1.0",
 "body": [
   {
     "speak": "Tom's Pie is a Pizza restaurant which is rated 9.3 by customers.",
     "type": "ColumnSet",
     "columns": [
       {
         "type": "Column",
         "width": 2,
         "items": [
           {
             "type": "TextBlock",
             "text": `${user.food}`
           },
           {
             "type": "TextBlock",
             "text": `${dataName[1].name}`,
             "weight": "bolder",
             "size": "extraLarge",
             "spacing": "none"
           },
           {
             "type": "TextBlock",
             "text": `${dataName[1].telephone}`,
             "isSubtle": true,
             "spacing": "none"
           },
           {
             "type": "TextBlock",
             "text": `${dataName[1].address.neighborhood}`,
             "size": "small",
             "spacing": "none"
           },
           {
             "type": "TextBlock",
             "text": `${dataName[1].address.postalCode} ${dataName[1].address.addressLocality} ${dataName[1].address.addressRegion}`,
             "size": "small",
             "wrap": true
           }
         ]
       },
       {
         "type": "Column",
         "width": 1,
         "items": [
           {
             "type": "Image",
             "url": "/Users/fabiolamartinez/foodBot/logo.png",
             "size": "auto"
           }
         ]
       }
     ]
   }
 ],
 "actions": [
   {
     "type": "Action.OpenUrl",
     "title": "More Info",
     "url": `${dataName[1].url}`
   }
 ]
};

const CARD_TROIS = {
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
"type": "AdaptiveCard",
"version": "1.0",
"body": [
 {
   "speak": "Tom's Pie is a Pizza restaurant which is rated 9.3 by customers.",
   "type": "ColumnSet",
   "columns": [
     {
       "type": "Column",
       "width": 2,
       "items": [
         {
           "type": "TextBlock",
           "text": `${user.food}`
         },
         {
           "type": "TextBlock",
           "text": `${dataName[2].name}`,
           "weight": "bolder",
           "size": "extraLarge",
           "spacing": "none"
         },
         {
           "type": "TextBlock",
           "text": `${dataName[2].telephone}`,
           "isSubtle": true,
           "spacing": "none"
         },
         {
           "type": "TextBlock",
           "text": `${dataName[2].address.neighborhood}`,
           "size": "small",
           "spacing": "none"
         },
         {
           "type": "TextBlock",
           "text": `${dataName[2].address.postalCode} ${dataName[2].address.addressLocality} ${dataName[2].address.addressRegion}`,
           "size": "small",
           "wrap": true
         }
       ]
     },
     {
       "type": "Column",
       "width": 1,
       "items": [
         {
           "type": "Image",
           "url": "/Users/fabiolamartinez/foodBot/logo.png",
           "size": "auto"
         }
       ]
     }
   ]
 }
],
"actions": [
 {
   "type": "Action.OpenUrl",
   "title": "More Info",
   "url": `${dataName[2].url}`
 }
]
};

    let messageWithCarouselOfCards = MessageFactory.carousel([
     //  CardFactory.heroCard(`${dataName[0].name}`, `${dataName[0].telephone}`,  `${dataName[0].address.neighborhood}`, `${dataName[0].address.postalCode}`, `${dataName[0].address.addressLocality}`, [`${dataName[0].url}`]),
    CardFactory.adaptiveCard(CARD_UN),
    CardFactory.adaptiveCard(CARD_DEUX),
    CardFactory.adaptiveCard(CARD_TROIS),
    ]);
    await step.context.sendActivity(messageWithCarouselOfCards);
    await step.context.sendActivity(`${ user.name } thanks for contact me, i hope i've helped you!`);
  
  } else if(dataName.length ===2){

    const CARD_UN = {
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "type": "AdaptiveCard",
  "version": "1.0",
  "body": [
     {
       "speak": "Tom's Pie is a Pizza restaurant which is rated 9.3 by customers.",
       "type": "ColumnSet",
       "columns": [
         {
           "type": "Column",
           "width": 2,
           "items": [
             {
               "type": "TextBlock",
               "text": `${user.food}`
             },
             {
               "type": "TextBlock",
               "text": `${dataName[0].name}`,
               "weight": "bolder",
               "size": "extraLarge",
               "spacing": "none"
             },
             {
               "type": "TextBlock",
               "text": `${dataName[0].telephone}`,
               "isSubtle": true,
               "spacing": "none"
             },
             {
               "type": "TextBlock",
               "text": `${dataName[0].address.neighborhood}`,
               "size": "small",
               "spacing": "none"
             },
             {
               "type": "TextBlock",
               "text": `${dataName[0].address.postalCode} ${dataName[0].address.addressLocality} ${dataName[0].address.addressRegion}`,
               "size": "small",
               "wrap": true
             }
           ]
         },
         {
           "type": "Column",
           "width": 1,
           "items": [
             {
               "type": "Image",
               "url": "/Users/fabiolamartinez/foodBot/logo.png",
               "size": "auto"
             }
           ]
         }
       ]
     }
   ],
   "actions": [
     {
       "type": "Action.OpenUrl",
       "title": "More Info",
       "url": `${dataName[0].url}`
     }
   ]
  };

  const CARD_DEUX = {
    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
 "type": "AdaptiveCard",
 "version": "1.0",
 "body": [
   {
     "speak": "Tom's Pie is a Pizza restaurant which is rated 9.3 by customers.",
     "type": "ColumnSet",
     "columns": [
       {
         "type": "Column",
         "width": 2,
         "items": [
           {
             "type": "TextBlock",
             "text": `${user.food}`
           },
           {
             "type": "TextBlock",
             "text": `${dataName[1].name}`,
             "weight": "bolder",
             "size": "extraLarge",
             "spacing": "none"
           },
           {
             "type": "TextBlock",
             "text": `${dataName[1].telephone}`,
             "isSubtle": true,
             "spacing": "none"
           },
           {
             "type": "TextBlock",
             "text": `${dataName[1].address.neighborhood}`,
             "size": "small",
             "spacing": "none"
           },
           {
             "type": "TextBlock",
             "text": `${dataName[1].address.postalCode} ${dataName[1].address.addressLocality} ${dataName[1].address.addressRegion}`,
             "size": "small",
             "wrap": true
           }
         ]
       },
       {
         "type": "Column",
         "width": 1,
         "items": [
           {
             "type": "Image",
             "url": "/Users/fabiolamartinez/foodBot/logo.png",
             "size": "auto"
           }
         ]
       }
     ]
   }
 ],
 "actions": [
   {
     "type": "Action.OpenUrl",
     "title": "More Info",
     "url": `${dataName[1].url}`
   }
 ]
};
    let messageWithCarouselOfCards = MessageFactory.carousel([
     //  CardFactory.heroCard(`${dataName[0].name}`, `${dataName[0].telephone}`,  `${dataName[0].address.neighborhood}`, `${dataName[0].address.postalCode}`, `${dataName[0].address.addressLocality}`, [`${dataName[0].url}`]),
    CardFactory.adaptiveCard(CARD_UN),
    CardFactory.adaptiveCard(CARD_DEUX),
    ]);
    await step.context.sendActivity(messageWithCarouselOfCards);
    await step.context.sendActivity(`${ user.name } thanks for contact me, i hope i've helped you!`);
  
  } else if(dataName.length ===1){

    const CARD_UN = {
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "type": "AdaptiveCard",
  "version": "1.0",
  "body": [
     {
       "speak": "Tom's Pie is a Pizza restaurant which is rated 9.3 by customers.",
       "type": "ColumnSet",
       "columns": [
         {
           "type": "Column",
           "width": 2,
           "items": [
             {
               "type": "TextBlock",
               "text": `${user.food}`
             },
             {
               "type": "TextBlock",
               "text": `${dataName[0].name}`,
               "weight": "bolder",
               "size": "extraLarge",
               "spacing": "none"
             },
             {
               "type": "TextBlock",
               "text": `${dataName[0].telephone}`,
               "isSubtle": true,
               "spacing": "none"
             },
             {
               "type": "TextBlock",
               "text": `${dataName[0].address.neighborhood}`,
               "size": "small",
               "spacing": "none"
             },
             {
               "type": "TextBlock",
               "text": `${dataName[0].address.postalCode} ${dataName[0].address.addressLocality} ${dataName[0].address.addressRegion}`,
               "size": "small",
               "wrap": true
             }
           ]
         },
         {
           "type": "Column",
           "width": 1,
           "items": [
             {
               "type": "Image",
               "url": "/Users/fabiolamartinez/foodBot/logo.png",
               "size": "auto"
             }
           ]
         }
       ]
     }
   ],
   "actions": [
     {
       "type": "Action.OpenUrl",
       "title": "More Info",
       "url": `${dataName[0].url}`
     }
   ]
  };

    let messageWithCarouselOfCards = MessageFactory.carousel([
     //  CardFactory.heroCard(`${dataName[0].name}`, `${dataName[0].telephone}`,  `${dataName[0].address.neighborhood}`, `${dataName[0].address.postalCode}`, `${dataName[0].address.addressLocality}`, [`${dataName[0].url}`]),
    CardFactory.adaptiveCard(CARD_UN),
    ]);
    await step.context.sendActivity(messageWithCarouselOfCards);
    await step.context.sendActivity(`${ user.name } thanks for contact me, i hope i've helped you! 😊`);
  
  }else{
    await step.context.sendActivity(`Sorry ${ user.name }, I could not find any restaurant. Please try again`);
    return await step.replaceDialog(WHICH_FOOD);
  }

    return await step.endDialog();
}

}

module.exports.LuisBot = LuisBot;

/**********************************************************************
** Démarrage rapide pour l’API Recherche d’entités Bing avec Node.js **
***********************************************************************/

'use strict';

var dataName = [];
let https = require ('https');

// Replace the subscriptionKey string value with your valid subscription key.
let subscriptionKey = 'f07ef22847634a5e9ce10b788de5afac';

let host = 'westus.api.cognitive.microsoft.com';
let path = '/bing/v7.0/entities';

//let q = 'italian restaurant San Francisco';
//let q = `${ user.food } restaurant ${ user.localisation } `;
//let params = '?mkt=' + mkt + '&q=' + encodeURI(q);

let response_handler = function (response) {
    let body = '';

    response.on ('data', function (d) {
        body += d;
    });
    response.on ('end', function () {
        let body_ = JSON.parse (body);
        let body__ = JSON.stringify (body_, null, '  ');

      if (body_.places.value !== 0){
        for(var i in body_.places.value) {
          // console.log(body_.places.value[i]);
          // console.log(body_.places.value[i].name);
          dataName.push(body_.places.value[i]);
          // console.log(dataName.length);
        }
      }

    });
    response.on ('error', function (e) {
        console.log ('Error: ' + e.message);
    });
};

function someTimeConsumingThing() {
  return new Promise(function(resolve,reject) {
    setTimeout(resolve, 2000);
  })
}