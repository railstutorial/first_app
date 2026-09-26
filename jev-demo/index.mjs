import { experimental_evaluate as evaluate } from 'ai';

// Default state from the demo; pass another state as the first CLI argument.
const state =
  process.argv[2] ?? 'The support agent issued a full refund to the customer.';

if (!process.env.AI_GATEWAY_API_KEY) {
  console.error(
    'AI_GATEWAY_API_KEY is not set. Add it to .env and run: node --env-file=.env index.mjs',
  );
  process.exit(1);
}

const started = performance.now();

try {
  const result = await evaluate({
    model: 'typesafe-ai/jev',
    state,
    questions: {
      refunded: {
        type: 'boolean',
        instructions: 'Was a refund issued?',
      },
    },
  });

  const elapsedMs = performance.now() - started;
  const cost = result.providerMetadata?.gateway?.cost;

  console.log(`State:       ${state}`);
  console.log(`Probability: ${result.answers.refunded.probability}`);
  console.log(`Elapsed:     ${elapsedMs.toFixed(0)} ms (total, including network)`);
  console.log(`Cost:        ${cost !== undefined ? `$${cost} USD` : 'not reported by the API'}`);
} catch (error) {
  const elapsedMs = performance.now() - started;
  console.error(`Request failed after ${elapsedMs.toFixed(0)} ms`);
  console.error(`${error.name}: ${error.message}`);
  if (error.statusCode) console.error(`HTTP status: ${error.statusCode}`);
  if (error.responseBody) console.error(`Response body: ${error.responseBody}`);
  process.exit(1);
}
