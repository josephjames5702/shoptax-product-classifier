import pymysql

# Enable PyMySQL as MySQLdb driver for MariaDB / MySQL connections
pymysql.install_as_MySQLdb()

from .celery import app as celery_app

__all__ = ('celery_app',)
