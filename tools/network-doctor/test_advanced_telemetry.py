import unittest
from advanced_telemetry import sample_tcp, device_capabilities, hourly_outages

class DummyConnection:
    def __enter__(self): return self
    def __exit__(self,*args): return False

class AdvancedTests(unittest.TestCase):
    def test_success_not_packet_loss(self):
        r=sample_tcp(count=3,connector=lambda *a,**k:DummyConnection())
        self.assertEqual(r["tcp_failure_percent"],0)
        self.assertIsNone(r["packet_loss_percent"])
    def test_failed_handshake(self):
        def fail(*a,**k): raise OSError("offline")
        r=sample_tcp(count=2,connector=fail)
        self.assertEqual(r["tcp_failure_percent"],100)
    def test_unknown_iphone_not_claimed(self):
        r=device_capabilities("ios")
        self.assertTrue(all(v=="unavailable" for v in r["availability"].values()))
    def test_insufficient_hourly_samples(self):
        r=hourly_outages([{"timestamp":"2026-10-17T12:00:00Z","ok":False}])
        self.assertIsNone(r["12:00 UTC"]["failure_rate_percent"])
    def test_hourly_grouping(self):
        r=hourly_outages([{"timestamp":f"2026-10-17T12:0{i}:00Z","ok":i>0} for i in range(3)])
        self.assertEqual(r["12:00 UTC"]["failure_rate_percent"],33.33)

if __name__=="__main__": unittest.main()
