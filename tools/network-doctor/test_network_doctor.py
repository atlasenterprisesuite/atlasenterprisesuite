import unittest
from unittest.mock import patch
import network_doctor as nd

class NetworkDoctorTests(unittest.TestCase):
    @patch.object(nd, "https_probe", return_value={"ok": True, "http_status": 200})
    @patch.object(nd, "tcp_probe", return_value={"ok": True})
    @patch.object(nd, "dns_probe", return_value={"ok": True})
    def test_verified(self, *_):
        self.assertTrue(nd.diagnose()["verified"])

    @patch.object(nd, "https_probe", return_value={"ok": False})
    @patch.object(nd, "tcp_probe", return_value={"ok": True})
    @patch.object(nd, "dns_probe", return_value={"ok": True})
    def test_tcp_not_enough(self, *_):
        self.assertFalse(nd.diagnose()["verified"])

    @patch.object(nd, "tcp_probe", return_value={"ok": False})
    @patch.object(nd, "dns_probe", return_value={"ok": False})
    def test_environment_failure_not_success(self, *_):
        result = nd.diagnose()
        self.assertEqual(result["status"], "unverified_environment_or_network")
        self.assertFalse(result["verified"])

    @patch.object(nd, "tcp_probe", return_value={"ok": True})
    @patch.object(nd, "dns_probe", return_value={"ok": False})
    def test_dns_suspected(self, *_):
        self.assertEqual(nd.diagnose()["status"], "dns_failure_suspected")

if __name__ == "__main__":
    unittest.main()
