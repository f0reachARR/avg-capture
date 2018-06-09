import * as React from 'react';
import { render } from 'react-dom';

import Index from './Index';

import '@blueprintjs/core/dist/blueprint.css';
import './main.css';

render(<Index />, document.querySelector('main'));