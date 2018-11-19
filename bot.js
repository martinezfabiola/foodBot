// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// const { ActivityTypes } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');

const { ChoicePrompt, DialogSet, NumberPrompt, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');

const { ActionTypes, ActivityTypes } = require('botbuilder');


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
    constructor(application, luisPredictionOptions, includeApiResults) {
        this.luisRecognizer = new LuisRecognizer(application, luisPredictionOptions, true);
    }


    /**
     * Every conversation turn calls this method.
     * There are no dialogs used, since it's "single turn" processing, meaning a single request and
     * response, with no stateful conversation.
     * @param {TurnContext} turnContext A TurnContext instance, containing all the data needed for processing the conversation turn.
     */
    async onTurn(turnContext) {
        // By checking the incoming Activity type, the bot only calls LUIS in appropriate cases.
        if (turnContext.activity.type === ActivityTypes.Message) {
            // Perform a call to LUIS to retrieve results for the user's message.
            const results = await this.luisRecognizer.recognize(turnContext);

            // Since the LuisRecognizer was configured to include the raw results, get the `topScoringIntent` as specified by LUIS.
            const topIntent = results.luisResult.topScoringIntent;

            if (topIntent.intent !== 'None') {
                await turnContext.sendActivity(`LUIS Top Scoring Intent: ${ topIntent.intent }, Score: ${ topIntent.score }`);
            } else {

                const { ActionTypes, ActivityTypes, CardFactory } = require('botbuilder');

                const reply = { type: ActivityTypes.Message };

                // // build buttons to display.
                const buttons = [
                { type: ActionTypes.ImBack, title: '1. Mexicain', value: '1' },
                { type: ActionTypes.ImBack, title: '2. Chinois', value: '2' },
                { type: ActionTypes.ImBack, title: '3. Thailandais', value: '3' }
                { type: ActionTypes.ImBack, title: '4. Italien', value: '4' }
                { type: ActionTypes.ImBack, title: '5. Francais', value: '5' }
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
            await turnContext.sendActivity('Welcome to the NLP with LUIS sample! Send me a message and I will try to predict your intent.');
        } else if (turnContext.activity.type !== ActivityTypes.ConversationUpdate) {
            // Respond to all other Activity types.
            await turnContext.sendActivity(`[${ turnContext.activity.type }]-type activity detected.`);
        }
    }
}

module.exports.LuisBot = LuisBot;