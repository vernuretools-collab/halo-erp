import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export function supabaseFirebaseAliases() {
  return {
    'firebase/firestore': path.join(here, 'firestoreCompat.js'),
    'firebase/auth': path.join(here, 'authCompat.js'),
    'firebase/storage': path.join(here, 'storageCompat.js'),
    'firebase/functions': path.join(here, 'functionsCompat.js'),
    'firebase/app': path.join(here, 'appCompat.js'),
    'firebase/messaging': path.join(here, 'messagingCompat.js'),
    // Shared files live outside each portal, so Node looks beside shared/ for this package.
    '@supabase/supabase-js': path.resolve(process.cwd(), 'node_modules/@supabase/supabase-js'),
  }
}
