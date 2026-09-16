import Capacitor
import UIKit

/// Registers the app-local Capacitor plugins (Capacitor 6 no longer auto-discovers
/// plugins that live in the app target).
class ClinicBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativePrintPlugin())
    }
}
