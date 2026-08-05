import { IonApp, setupIonicReact } from '@ionic/react';
import { BrowserRouter as Router } from 'react-router-dom';

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
import 'leaflet/dist/leaflet.css';
import './theme/variables.css';

import AppRouter from './AppRouter';

setupIonicReact();

function App() {
  return (
    <IonApp>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRouter />
      </Router>
    </IonApp>
  );
}

export default App;