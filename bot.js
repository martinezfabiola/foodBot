// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// const { ActivityTypes } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');

const { ChoicePrompt, DialogSet, NumberPrompt, TextPrompt, WaterfallDialog, DialogTurnStatus } = require('botbuilder-dialogs');

const { ActionTypes, ActivityTypes } = require('botbuilder');

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
        // this.dialogs.add(new NumberPrompt(AGE_PROMPT, async (prompt) => {
        //     if (prompt.recognized.succeeded) {
        //         if (prompt.recognized.value <= 0) {
        //             await prompt.context.sendActivity(`Your age can't be less than zero.`);
        //             return false;
        //         } else {
        //             return true;
        //         }
        //     }
        //     return false;
        // }));

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
         await turnContext.sendActivity('Welcome to our FoodBot ! Send me a message and I will try to predict your intent to find a restaurant. Say Hi !');
     }

     // ...
     // Save changes to the user state.
     await this.userState.saveChanges(turnContext);

     // End this turn by saving changes to the conversation state.
     await this.conversationState.saveChanges(turnContext);
 }


/***********************************************************************************************************************/
/***********************************************************************************************************************/


// This step in the dialog prompts the user for their name.
async promptForName(step) {
    return await step.prompt(NAME_PROMPT, `What is your name, human?`);
}

// This step in the dialog prompts the user for their name.
async confirmNamePrompt(step) {
  const user = await this.userProfile.get(step.context, {});
  user.name = step.result;
  await this.userProfile.set(step.context, user);

    return await step.beginDialog(WHICH_FOOD);
}

// This step captures the user's name, then prompts whether or not to collect an age.
async confirmFoodPrompt(step) {

    await step.prompt(CONFIRM_PROMPT, 'Do you know what you want to eat ?', ['yes', 'no']);
}

// This step checks the user's response - if yes, the bot will proceed to prompt for age.
// Otherwise, the bot will skip the age step.
async promptForFood(step) {
    if (step.result && step.result.value === 'yes') {
        return await step.prompt(FOOD_PROMPT, `Tell me what kind of food would you prefer ?`,
            {
                retryPrompt: 'Sorry, I do not anderstand or say cancel.'
            }
        );
    } else {
        return await step.next(-1);
    }
}

// This step captures the user's age.
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
            user.food = step.result;
            await this.userProfile.set(step.context, user);
            await step.context.sendActivity(`Sorry, I do not anderstand or say cancel.`);
            return await step.replaceDialog(WHICH_FOOD);
        }

        // await step.context.sendActivity(`I will remember that you want this kind of food :  ${ step.result } `);
    } else {// si l'user ne sait pas quelle genre de food il veut

            const { ActionTypes, ActivityTypes, CardFactory } = require('botbuilder');

            const reply = { type: ActivityTypes.Message };

            // // build buttons to display.
            const buttons = [
            { type: ActionTypes.ImBack, title: '1. European', value: '1' },
            { type: ActionTypes.ImBack, title: '2. Chinese', value: '2' },
            { type: ActionTypes.ImBack, title: '3. American/Mexican', value: '3' }
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

// This step displays the captured information back to the user.
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
      } else {
        user.food = "American";
        await this.userProfile.set(step.context, user);
      }

      await step.context.sendActivity(`Your name is ${ user.name } and you would like this kind of food : ${ user.food }.`);
    }
    return await step.beginDialog(WHICH_PRICE);
    //return await step.endDialog();
}

// This step captures the user's age.
async capturePrice(step) {
    const user = await this.userProfile.get(step.context, {});

    const { ActionTypes, ActivityTypes, CardFactory } = require('botbuilder');

    const reply = { type: ActivityTypes.Message };

    // // build buttons to display.
    const buttons = [
    { type: ActionTypes.ImBack, title: '1. *', value: '1' },
    { type: ActionTypes.ImBack, title: '2. **', value: '2' },
    { type: ActionTypes.ImBack, title: '3. ***', value: '3' }
    ];

    // // construct hero card.
    const card = CardFactory.heroCard('', undefined,
    buttons, { text: 'For how much do you want to eat ?' });

    // // add card to Activity.
    reply.attachments = [card];

    // // Send hero card to the user.
    await step.context.sendActivity(reply);
}

// This step displays the captured information back to the user.
async displayPriceChoice(step) {
    const user = await this.userProfile.get(step.context, {});

    if (step.context.activity.text == 1) {
      user.price = "Low price";
      await this.userProfile.set(step.context, user);
    }  else if (step.context.activity.text == 2) {
      user.price = "Medium price";
      await this.userProfile.set(step.context, user);
    } else {
      user.price = "High price";
      await this.userProfile.set(step.context, user);
    }

    await step.context.sendActivity(`${ user.name } you would like this kind of food : ${ user.food } and for a ${ user.price }`);

    return await step.beginDialog(WHICH_LOCALISATION);
}

// This step captures the restaurant's localisation, then prompts whether or not to collect a localisation.
async confirmLocalisationPrompt(step) {

    await step.prompt(CONFIRM_LOCALISATION_PROMPT, 'Do you know where you want to eat ?', ['yes', 'no']);
}

// This step checks the user's response - if yes, the bot will proceed to prompt for localisation.
// Otherwise, the bot will skip the localisation step.
async promptForLocalisation(step) {
    if (step.result && step.result.value === 'yes') {
        return await step.prompt(LOCALISATION_PROMPT, `Tell me where would you prefer to eat ?`,
            {
                retryPrompt: 'Sorry, I do not anderstand or say cancel.'
            }
        );
    } else {
        return await step.next(-1);
    }
}

// This step captures the restaurant's localisation.
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
            //await this.userProfile.set(step.context, user);
            await step.context.sendActivity(`Sorry, I do not anderstand or say cancel.`);
            return await step.replaceDialog(WHICH_LOCALISATION);
        }

        // await step.context.sendActivity(`I will remember that you want this kind of food :  ${ step.result } `);
    } else {// si l'user ne sait pas quelle genre de food il veut

            const { ActionTypes, ActivityTypes, CardFactory } = require('botbuilder');

            const reply = { type: ActivityTypes.Message };

            // // build buttons to display.
            const buttons = [
            { type: ActionTypes.ImBack, title: '1. Near to you', value: '1' },
            { type: ActionTypes.ImBack, title: '2. About 5km around you', value: '2' },
            { type: ActionTypes.ImBack, title: '3. About 15km around you', value: '3' }
            ];

            // // construct hero card.
            const card = CardFactory.heroCard('', undefined,
            buttons, { text: 'Where do you want to eat ?' });

            // // add card to Activity.
            reply.attachments = [card];

            // // Send hero card to the user.
            await step.context.sendActivity(reply);

        }
        //return await step.beginDialog(WHICH_PRICE);
    //return await step.endDialog();
}

// This step displays the captured information back to the user.
async displayLocalisationChoice(step) {
    const user = await this.userProfile.get(step.context, {});
    if (user.localisation) {
        await step.context.sendActivity(`${ user.name } you would like to eat : ${ user.food } where it's ${ user.localisation } from you`);
    } else {
      const user = await this.userProfile.get(step.context, {});

      //await step.context.sendActivity(`[${ step.context.activity.text }]-type activity detected.`);

      if (step.context.activity.text == 1) {
        user.localisation = "near";
        await this.userProfile.set(step.context, user);
      }  else if (step.context.activity.text == 2) {
        user.localisation = "5 km";
        await this.userProfile.set(step.context, user);
      } else {
        user.localisation = "15 km";
        await this.userProfile.set(step.context, user);
      }

      await step.context.sendActivity(`${ user.name } you would like to eat : ${ user.food } where it's located : ${ user.localisation }`);
    }

    return await step.endDialog();
}

// This step displays the captured information back to the user.
async displayProfile(step) {
    const user = await this.userProfile.get(step.context, {});

    await step.context.sendActivity(`${ user.name } Your order is on your way ! You would like this kind of food : ${ user.food } less than ${ user.localisation }km from you, for a ${ user.price }`);


    return await step.endDialog();
}



}

module.exports.LuisBot = LuisBot;



/*
  async promptFood(turnContext) {
      // By checking the incoming Activity type, the bot only calls LUIS in appropriate cases.
      if (turnContext.activity.type === ActivityTypes.Message) {
          // Perform a call to LUIS to retrieve results for the user's message.
          const results = await this.luisRecognizer.recognize(turnContext);

          // Since the LuisRecognizer was configured to include the raw results, get the `topScoringIntent` as specified by LUIS.
          const topIntent = results.luisResult.topScoringIntent;

          if (topIntent.intent == 'FindARestaurant') {
              await turnContext.sendActivity(`LUIS Top Scoring Intent OK`);
          } else if (topIntent.intent !== 'None') {
            await turnContext.sendActivity(`LUIS Top Scoring Intent: ${ topIntent.intent }, Score: ${ topIntent.score }`);
          }
          else {

              const { ActionTypes, ActivityTypes, CardFactory } = require('botbuilder');

              const reply = { type: ActivityTypes.Message };

              // // build buttons to display.
              const buttons = [
              { type: ActionTypes.ImBack, title: '1. Mexicain', value: '1' },
              { type: ActionTypes.ImBack, title: '2. Chinois', value: '2' },
              { type: ActionTypes.ImBack, title: '3. Thailandais', value: '3' }
              ];

              // // construct hero card.
              const card = CardFactory.heroCard('', undefined,
              buttons, { text: 'Quel restaurant voulez-vous?' });

              // // add card to Activity.
              reply.attachments = [card];

              // // Send hero card to the user.
              await turnContext.sendActivity(reply);

              // If the top scoring intent was "None" tell the user no valid intents were found and provide help.
              // await turnContext.sendActivity(`No LUIS intents were found.
              //                                 \nThis sample is about identifying two user intents:
              //                                 \n - 'Calendar.Add'
              //                                 \n - 'Calendar.Find'
              //                                 \nTry typing 'Add Event' or 'Show me tomorrow'.`);
          }
      } else if (turnContext.activity.type === ActivityTypes.ConversationUpdate &&
          turnContext.activity.recipient.id !== turnContext.activity.membersAdded[0].id) {
          // If the Activity is a ConversationUpdate, send a greeting message to the user.
          await turnContext.sendActivity('Welcome to our FoodBot ! Send me a message and I will try to predict your intent to find a restaurant ');
      } else if (turnContext.activity.type !== ActivityTypes.ConversationUpdate) {
          // Respond to all other Activity types.
          await turnContext.sendActivity(`[${ turnContext.activity.type }]-type activity detected.`);
      }
  }
  */
