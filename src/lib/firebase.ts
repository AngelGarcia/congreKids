import { initializeFirebase } from '@/firebase';

/**
 * Firebase initialization using the standardized studio pattern.
 * This ensures we use the correct configuration (apiKey, projectId, etc.)
 * provided by the environment or the local config file.
 */
const { auth, firestore: db } = initializeFirebase();

export { auth, db };
