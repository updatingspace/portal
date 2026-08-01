import os
import sys


def main():
    from django.core.management import execute_from_command_line

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "app.settings")
    execute_from_command_line(sys.argv)

if __name__ == "__main__":
    main()
