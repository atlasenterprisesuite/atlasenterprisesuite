import { NavLink } from 'react-router-dom';

export function OperationsNav() {
  return <nav className="health-subnav" aria-label="Health operations"><NavLink to="/health/operations/command-center">Command Center</NavLink><NavLink to="/health/operations/modules">Module Directory</NavLink><NavLink to="/health/research">Research</NavLink></nav>;
}
