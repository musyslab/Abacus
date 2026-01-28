import { Component } from 'react'
import { Navigate } from 'react-router-dom'

class LandingPage extends Component {
  render() {
    return <Navigate to="/home" replace />;
  }
}

export default LandingPage;
