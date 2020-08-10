# Gunicorn config

# This config mainly increases the workers/thread count from default 1,1
pidfile = "/var/log/acp_prod/gunicorn/gunicorn.pid"

worker_class = "gthread"
workers = 10
threads = 15
max_requests = 1000
max_requests_jitter = 100

reload = True

capture_output = "True"
errorlog = "/var/log/acp_prod/gunicorn/gunicorn.err"
accesslog = "/var/log/acp_prod/gunicorn/gunicorn.log"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

#statsd_host = "localhost:9125"
#statsd_prefix = "acp_web"
