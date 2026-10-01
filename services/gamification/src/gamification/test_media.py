import io
import uuid
from unittest.mock import MagicMock, patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from ninja.errors import HttpError
from PIL import Image

from gamification.media import MAX_BYTES, read_image, save_image


class AchievementMediaTests(SimpleTestCase):
    def test_upload_validates_content_and_stores_under_current_tenant(self):
        output = io.BytesIO()
        Image.new("RGB", (32, 32)).save(output, format="PNG")
        tenant = str(uuid.uuid4())
        client = MagicMock()
        with patch(
            "gamification.media.storage", return_value=(client, "private-media")
        ):
            result = save_image(
                tenant_id=tenant,
                upload=SimpleUploadedFile("image.png", output.getvalue()),
            )
        call = client.put_object.call_args.kwargs
        self.assertEqual(call["ContentType"], "image/png")
        self.assertTrue(call["Key"].startswith(f"achievements/{tenant}/"))
        self.assertEqual(
            result["url"], "/api/v1/gamification/media/" + call["Key"].split("/")[-1]
        )

    def test_rejects_fake_images_and_oversized_files_before_storage(self):
        for body in (b'<svg onload="alert(1)"></svg>', b"x" * (MAX_BYTES + 1)):
            with patch("gamification.media.storage") as storage:
                with self.assertRaises(HttpError):
                    save_image(
                        tenant_id=str(uuid.uuid4()),
                        upload=SimpleUploadedFile("fake.png", body),
                    )
                storage.assert_not_called()

    def test_read_key_always_uses_request_tenant(self):
        client = MagicMock()
        image = str(uuid.uuid4())
        tenant = str(uuid.uuid4())
        stream = io.BytesIO(b"image")
        client.get_object.return_value = {"Body": stream, "ContentType": "image/png"}
        with patch(
            "gamification.media.storage", return_value=(client, "private-media")
        ):
            self.assertEqual(
                read_image(tenant_id=tenant, image_id=image), (b"image", "image/png")
            )
        client.get_object.assert_called_once_with(
            Bucket="private-media", Key=f"achievements/{tenant}/{image}"
        )
        self.assertTrue(stream.closed)

    def test_signed_multipart_upload_uses_the_real_api_contract(self):
        from django.test import Client
        from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart

        from gamification.tests import _headers

        tenant = str(uuid.uuid4())
        output = io.BytesIO()
        Image.new("RGB", (32, 32)).save(output, format="PNG")
        body = encode_multipart(
            BOUNDARY,
            {
                "file": SimpleUploadedFile(
                    "award.png",
                    output.getvalue().ljust(MAX_BYTES, b"\0"),
                    content_type="image/png",
                )
            },
        )
        path = "/api/v1/gamification/media"
        headers = _headers(
            method="POST",
            path=path,
            body=body,
            tenant_id=tenant,
            tenant_slug="alpha",
            user_id=str(uuid.uuid4()),
            master_flags={"system_admin": True},
            request_id="media-http-test",
        )
        headers.pop("CONTENT_TYPE")
        with patch(
            "gamification.media.storage", return_value=(MagicMock(), "private-media")
        ):
            response = Client().generic(
                "POST", path, data=body, content_type=MULTIPART_CONTENT, **headers
            )
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(
            response.json()["url"].startswith("/api/v1/gamification/media/")
        )

        headers["HTTP_X_UPDSPACE_SIGNATURE"] = "invalid"
        with patch("gamification.media.storage") as storage:
            response = Client().generic(
                "POST", path, data=body, content_type=MULTIPART_CONTENT, **headers
            )
        self.assertEqual(response.status_code, 401)
        storage.assert_not_called()
