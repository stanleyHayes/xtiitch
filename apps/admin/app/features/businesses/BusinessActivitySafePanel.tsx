import { Component, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import { BusinessActivityPanel } from "./BusinessActivityPanel";

type Props = { businessId: string };
type State = { failed: boolean };

/** Keeps a render fault in the activity feed from blanking the whole business record. */
export class BusinessActivitySafePanel extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidUpdate(prevProps: Props) {
    if (prevProps.businessId !== this.props.businessId && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <Alert severity="warning">
          Activity could not be shown for this business. Try Overview, then open
          Activity again — unverified tenants with sparse history should still
          load an empty feed.
        </Alert>
      );
    }
    return (
      <BusinessActivityPanel
        key={this.props.businessId}
        businessId={this.props.businessId}
      />
    );
  }
}
