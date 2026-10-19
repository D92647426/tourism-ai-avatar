from app.core.database import reset_database
from app.services.avatar_service import get_active_avatar, save_avatar_config
from tests.postgres_test_utils import postgres_test_database_url


def test_avatar_config_persists_in_database():
    reset_database(postgres_test_database_url("avatar"))

    saved = save_avatar_config({"name": "灵灵测试", "voice_name": "female_test", "opening_text": "欢迎测试。"})
    loaded = get_active_avatar()

    assert saved["name"] == "灵灵测试"
    assert loaded["voice_name"] == "female_test"
    assert loaded["opening_text"] == "欢迎测试。"
