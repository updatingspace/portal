from activity.connectors.custom import CustomConnector
from activity.connectors.minecraft import MinecraftConnector
from activity.connectors.registry import register_connector
from activity.connectors.steam import SteamConnector


def install_connectors() -> None:
    # Built-in connectors for MVP.
    register_connector(MinecraftConnector())
    register_connector(CustomConnector())
    register_connector(SteamConnector())
