import { closeDatabase, connectToDatabase } from '../config';
import { createScopedLogger } from '../utils';

const logger = createScopedLogger('scripts/createAgentNumberIndex');

async function createAgentNumberIndex() {
  try {
    const db = await connectToDatabase();
    const agentsCollection = db.collection('agents');

    // Create unique index on agentNumber field
    await agentsCollection.createIndex({ agentNumber: 1 }, { unique: true, sparse: false });

    logger.log('Successfully created unique index on agentNumber field');

    // Initialize the counter if it doesn't exist
    const countersCollection = db.collection('counters');
    const existingCounter = await countersCollection.findOne({ _id: 'agentNumber' as any });

    if (!existingCounter) {
      // Check if there are existing agents to determine the starting counter value
      const highestAgent = await agentsCollection
        .find({ agentNumber: { $exists: true } })
        .sort({ agentNumber: -1 })
        .limit(1)
        .toArray();

      const startingValue = highestAgent.length > 0 ? highestAgent[0].agentNumber : 0;

      await countersCollection.insertOne({
        _id: 'agentNumber' as any,
        sequence: startingValue,
      });

      logger.log(`Initialized agent counter with starting value: ${startingValue}`);
    } else {
      logger.log(`Agent counter already exists with value: ${existingCounter.sequence}`);
    }
  } catch (error) {
    logger.error('Error creating agent number index:', error);
    throw error;
  } finally {
    await closeDatabase();
  }
}

// Run the script if executed directly
if (require.main === module) {
  createAgentNumberIndex()
    .then(() => {
      logger.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Script failed:', error);
      process.exit(1);
    });
}

export { createAgentNumberIndex };
