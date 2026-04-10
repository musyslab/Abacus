from flask_caching import Cache
from apscheduler.schedulers.background import BackgroundScheduler

cache = Cache()
scheduler = BackgroundScheduler()