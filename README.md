# Adaptive City Program Web System

## Overview
ACP Web provides the web access to the ACP Platform, supporting three main capabilities:
1. A visual display of data collected via ACP Server.
2. API's providing 3rd-party access to the collected data (both http/restful and zip download).
3. A highly flexible 'SmartPanel' system supporting web display of real-time content.

## Installation

This is a django application developed to be used with Python 3. To run the application follow these steps:

```
git clone https://github.com/AdaptiveCity/acp_web
cd acp_web
python3 -m venv venv
source venv/bin/activate
python3 -m pip install pip --upgrade
python3 -m pip install wheel
python3 -m pip install -r requirements.txt
```

Copy `~acp_prod/acp_web/secrets` directory from another server.

### Configure the database:
Install and configure postgreSQL database
```
sudo apt install postgresql postgresql-contrib postgis
```

See
```
https://www.digitalocean.com/community/tutorials/how-to-use-postgresql-with-your-django-application-on-ubuntu-14-04
```

Create database, user `acp_prod`

```
systemctl status postgresql
```

