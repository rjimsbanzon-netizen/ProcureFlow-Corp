import { HtmlView } from '../components/HtmlView';
import { renderAmendmentsView } from '../views/amendments';

/** React screen preserving the original amendments workflow and table markup. */
export default function AmendmentsPage() {
  return <HtmlView html={renderAmendmentsView()} />;
}
