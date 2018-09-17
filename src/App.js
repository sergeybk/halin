import React, { Component } from 'react';
import {
  GraphAppBase,
  ConnectModal,
  CONNECTED
} from 'graph-app-kit/components/GraphAppBase';
import { Render } from 'graph-app-kit/components/Render';
import Neo4jConfiguration from './configuration/Neo4jConfiguration';
import PerformancePane from './performance/PerformancePane';
import DBSize from './performance/DBSize';
import PermissionsPane from './configuration/PermissionsPane';
import { Tab, Image } from 'semantic-ui-react'
import DiagnosticPane from './diagnostic/DiagnosticPane';

import './App.css';
import 'semantic-ui-css/semantic.min.css';
import HalinContext from './data/HalinContext';

const neo4j = require('neo4j-driver/lib/browser/neo4j-web.min.js').v1;

class Halin extends Component {
  state = {
    cTag: 1
  };

  reRunManually = () => {
    this.setState(state => ({ cTag: state.cTag + 1 }));
  };

  paneWrapper = obj =>
    <div className='PaneWrapper'>{obj}</div>;

  componentDidMount() {
    try {
      window.halinContext = new HalinContext();
    } catch (e) {
      console.error(e);
    }
  }

  render() {
    const panes = [
      {
        menuItem: 'Performance',
        render: () => this.paneWrapper(<PerformancePane />),
      },
      {
        menuItem: 'User Management',
        render: () => this.paneWrapper(<PermissionsPane />),
      },
      {
        menuItem: 'Database',
        render: () => this.paneWrapper(<DBSize />),
      },
      {
        menuItem: 'Configuration',
        render: () => this.paneWrapper(<Neo4jConfiguration />),
      },
      {
        menuItem: 'Diagnostics',
        render: () => this.paneWrapper(
          <DiagnosticPane />
        ),
      },
    ]

    return (
      <div className="App" key="app">
        <header className="App-header">
          <Image className="App-logo" src='img/halingraph.gif' size='tiny' />
        </header>

        <Render if={this.props.connected}>
          <div className='MainBody'>
            <Tab panes={panes} />
          </div>
        </Render>
      </div>
    );
  }
}

const App = () => {
  return (
    <GraphAppBase
      driverFactory={neo4j}
      integrationPoint={window.neo4jDesktopApi}
      render={({ connectionState, connectionDetails, setCredentials }) => {
        return [
          <ConnectModal
            key="modal"
            errorMsg={connectionDetails ? connectionDetails.message : ""}
            onSubmit={setCredentials}
            show={connectionState !== CONNECTED}
          />,
          <Halin key="app" connected={connectionState === CONNECTED} />
        ];
      }}
    />
  );
};

export default App;
