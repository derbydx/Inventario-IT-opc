import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from a2wsgi import ASGIMiddleware
from main import app
application = ASGIMiddleware(app)
