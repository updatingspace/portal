import uuid
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model

from .models import OutboxMessage, Poll, Nomination, Option, Vote, PollStatus, PollScopeType
from .services import cast_vote, get_poll_results, VotingServiceError

User = get_user_model()

class VotingServiceTests(TestCase):
    def setUp(self):
        self.tenant_id = str(uuid.uuid4())
        self.user_id = str(uuid.uuid4())
        
        # Create Poll
        self.poll = Poll.objects.create(
            tenant_id=self.tenant_id,
            title="Service Unit Test Poll",
            status=PollStatus.ACTIVE,
            scope_type=PollScopeType.TENANT,
            scope_id=self.tenant_id,
            created_by=self.user_id,
            starts_at=timezone.now() - timedelta(minutes=10),
            ends_at=timezone.now() + timedelta(hours=1)
        )
        
        # Create Nomination
        self.nomination = Nomination.objects.create(
            poll=self.poll,
            title="Best App",
            sort_order=1
        )
        
        # Create Options
        self.option1 = Option.objects.create(
            nomination=self.nomination,
            title="Option 1"
        )
        self.option2 = Option.objects.create(
            nomination=self.nomination,
            title="Option 2"
        )


    def test_cast_vote_success(self):
        vote = cast_vote(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            poll=self.poll,
            nomination_id=self.nomination.id,
            option_id=self.option1.id
        )
        
        self.assertIsInstance(vote, Vote)
        self.assertEqual(Vote.objects.filter(poll=self.poll).count(), 1)
        
        # Check Outbox
        messages = OutboxMessage.objects.filter(event_type="voting.vote.cast")
        self.assertEqual(messages.count(), 1)
        self.assertEqual(messages.first().payload["vote_id"], str(vote.id))

    def test_cast_vote_closed_poll(self):
        self.poll.status = PollStatus.CLOSED
        self.poll.save()
        
        with self.assertRaises(VotingServiceError) as cm:
            cast_vote(
                tenant_id=self.tenant_id,
                user_id=self.user_id,
                poll=self.poll,
                nomination_id=self.nomination.id,
                option_id=self.option1.id
            )
        self.assertEqual(cm.exception.code, "POLL_CLOSED")

    def test_cast_vote_duplicate(self):
        # First vote
        cast_vote(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            poll=self.poll,
            nomination_id=self.nomination.id,
            option_id=self.option1.id
        )
        
        # Second vote same nomination
        with self.assertRaises(VotingServiceError) as cm:
            cast_vote(
                tenant_id=self.tenant_id,
                user_id=self.user_id,
                poll=self.poll,
                nomination_id=self.nomination.id,
                option_id=self.option2.id # Different option, but same nomination/poll constraint
            )
        self.assertEqual(cm.exception.code, "TOO_MANY_VOTES")

    def test_get_poll_results(self):
        # 1 vote for Option 1
        cast_vote(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            poll=self.poll,
            nomination_id=self.nomination.id,
            option_id=self.option1.id
        )
        
        # Another user, 1 vote for Option 2
        cast_vote(
            tenant_id=self.tenant_id,
            user_id=str(uuid.uuid4()),
            poll=self.poll,
            nomination_id=self.nomination.id,
            option_id=self.option2.id
        )
        
        results = get_poll_results(self.poll)
        
        self.assertEqual(len(results.nominations), 1)
        res_nom = results.nominations[0]
        self.assertEqual(res_nom.nomination_id, self.nomination.id)
        
        # Check options counts
        opts_map = {o.option_id: o.votes for o in res_nom.options}
        self.assertEqual(opts_map[self.option1.id], 1)
        self.assertEqual(opts_map[self.option2.id], 1)
