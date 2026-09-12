import Capacitor
import UIKit

/**
 Capacitor auto-registers plugins from Swift packages, but a plugin defined
 loose in the app target lands in an empty `packageClassList` and is never
 loaded — `Capacitor.isPluginAvailable("AuxiloNative")` returns false and calls
 hang. Registering the instance here in `capacitorDidLoad()` is the documented
 fix (ionic-team/capacitor#7409).

 The storyboard points its root view controller at this class instead of the
 stock CAPBridgeViewController.
 */
class AuxiloViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(AuxiloNativePlugin())
    }
}
