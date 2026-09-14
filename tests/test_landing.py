"""Run with: venv/Scripts/python.exe -m unittest discover -s tests -v.

All report writes use an isolated in-memory database, never installation records.
"""
import os
os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['PYTHONDONTWRITEBYTECODE'] = '1'
import unittest
from unittest.mock import patch
import httpx
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from backend.app.main import app
from backend.app.db import Base, get_db


class LandingIntegration(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        session = sessionmaker(bind=self.engine)
        def isolated_db():
            with session() as db:
                yield db
        app.dependency_overrides[get_db] = isolated_db
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        self.engine.dispose()

    def test_routes_and_assets(self):
        for url in ['/', '/index.html', '/officer.html', '/models/TomatoPlant_Final.glb', '/vendor/three/three.module.js', '/vendor/three/GLTFLoader.js', '/health', '/api/stats', '/api/scans', '/api/outbreaks']:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 200)
        self.assertIn('One diseased leaf.', self.client.get('/').text)
        self.assertNotIn('id="map"', self.client.get('/').text)
        self.assertIn('id="map"', self.client.get('/officer.html').text)

    def test_report_round_trip(self):
        payload = dict(device_id='landing-test', crop='Sample crop', disease='Sample disease', confidence=.7, latitude=0, longitude=0, treatment='Test guidance')
        result = self.client.post('/api/scans', json=payload)
        self.assertEqual(result.status_code, 201)
        self.assertEqual(self.client.get('/api/scans/'+result.json()['id']).json()['device_id'], 'landing-test')
        self.assertEqual(self.client.get('/api/scans?crop=Sample').json()['total'], 1)
        self.assertEqual(self.client.get('/api/stats').json()['total_scans'], 1)

    def test_existing_auth_contract(self):
        result = self.client.post('/api/auth/device', json={'device_id':'landing-test','platform':'web'})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['device_id'], 'landing-test')

    def proxy(self, handler):
        original = httpx.AsyncClient
        return patch('backend.app.routes.diagnosis.httpx.AsyncClient', side_effect=lambda **kw: original(transport=httpx.MockTransport(handler), **kw))

    def test_proxy_preserves_crop_hint_and_unsupported_result(self):
        def handler(request):
            self.assertEqual(request.url.params['crop'], 'Tomato')
            self.assertEqual(request.url.path, '/predict')
            self.assertIn(b'leaf.png', request.content)
            return httpx.Response(200,json={'is_supported':False,'message':'Try another photo.'})
        with self.proxy(handler):
            result = self.client.post('/api/diagnose?crop=Tomato', files={'file':('leaf.png',b'sample','image/png')})
        self.assertEqual(result.status_code,200)
        self.assertFalse(result.json()['is_supported'])

    def test_proxy_preserves_success(self):
        expected={'is_supported':True,'prediction':{'crop':'Sample','disease':'Sample','confidence':.8,'treatment':'Test only'},'top_3':[]}
        with self.proxy(lambda request: httpx.Response(200,json=expected)):
            result=self.client.post('/api/diagnose',files={'file':('leaf.png',b'sample','image/png')})
        self.assertEqual(result.json(),expected)

    def test_proxy_unavailable_is_not_fabricated_diagnosis(self):
        def handler(request):
            raise httpx.ConnectError('offline',request=request)
        with self.proxy(handler):
            result=self.client.post('/api/diagnose',files={'file':('leaf.png',b'sample','image/png')})
        self.assertEqual(result.status_code,503)
        self.assertNotIn('prediction',result.json())

    def test_proxy_size_limit(self):
        result=self.client.post('/api/diagnose',files={'file':('leaf.png',b'x'*(5*1024*1024+1),'image/png')})
        self.assertEqual(result.status_code,413)

if __name__ == '__main__':
    unittest.main()
