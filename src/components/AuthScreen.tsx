import { HtmlView } from './HtmlView';
import { renderAuthScreen } from '../views/auth';
export function AuthScreen() { return <HtmlView html={renderAuthScreen()} />; }
