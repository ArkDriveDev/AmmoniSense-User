import { IonApp, setupIonicReact } from '@ionic/react';
import { BrowserRouter as Router } from 'react-router-dom';
import { useEffect } from 'react';
import { initializePushNotifications } from './services/pushNotifications';
import { supabase } from './services/supabase';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import './theme/variables.css';

import AppRouter from './AppRouter';

setupIonicReact();

function App() {
  useEffect(() => {
    initializePushNotifications();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          const { removeDeviceToken } = await import('./services/pushNotifications');
          removeDeviceToken();
        }
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  return (
    <IonApp>
      <Router>
        <AppRouter />
      </Router>
    </IonApp>
  );
}

export default App;