"""A bull choice changes one unresolved physical dart, preserving the visit."""
import copy
from pathlib import Path
import sys
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import camera_bull_corner_choice


class BullCornerChoice(unittest.TestCase):
    def setUp(self):
        self.state = {'game': 'fourinarow', 'phase': 'playing',
                      'fourBoard': ['n1'] * 25, 'fourOwners': [None] * 25}
        for cell in [0, 4, 20, 24]: self.state['fourBoard'][cell] = 'sb'
        self.before = {'owner': 'camera', 'hits': [
            {'number': 25, 'mult': 1, 'cell': None, 'needsBullCorner': True},
            {'number': 20, 'mult': 3, 'cell': 5, 'needsBullCorner': False},
            {'number': 25, 'mult': 1, 'cell': None, 'needsBullCorner': True}]}
        self.after = copy.deepcopy(self.before['hits'])
        self.after[0] = {'number': 25, 'mult': 1, 'cell': 24, 'label': 'sB'}
        self.after[1].pop('needsBullCorner')  # Normal browser JSON omits false flags.

    def test_preserves_later_darts_and_other_pending_bulls(self):
        self.assertTrue(camera_bull_corner_choice(self.state, self.before, self.after))
        previous = {'owner': 'controller', 'hits': self.after}
        final = copy.deepcopy(self.after)
        final[2] = {'number': 25, 'mult': 1, 'cell': 4}
        self.assertTrue(camera_bull_corner_choice(self.state, previous, final))

    def test_never_reuses_or_takes_an_occupied_corner(self):
        self.state['fourOwners'][24] = 1
        self.assertFalse(camera_bull_corner_choice(self.state, self.before, self.after))
        self.state['fourOwners'][24] = None
        self.before['hits'][1] = {'number': 25, 'mult': 1, 'cell': 24}
        self.after[1] = dict(self.before['hits'][1])
        self.assertFalse(camera_bull_corner_choice(self.state, self.before, self.after))

    def test_rejects_other_dart_edits_or_a_different_game(self):
        for key, value in [('number', 19), ('mult', 2), ('cell', 6)]:
            changed = copy.deepcopy(self.after)
            changed[1][key] = value
            self.assertFalse(camera_bull_corner_choice(self.state, self.before, changed))
        for key, value in [('game', 'x01'), ('phase', 'won')]:
            state = {**self.state, key: value}
            self.assertFalse(camera_bull_corner_choice(state, self.before, self.after))

    def test_rejects_invalid_choices_and_count_changes(self):
        for cell in [None, True, -1, 25, 12, '24']:
            changed = copy.deepcopy(self.after)
            changed[0]['cell'] = cell
            self.assertFalse(camera_bull_corner_choice(self.state, self.before, changed))
        self.assertFalse(camera_bull_corner_choice(self.state, self.before, self.after[:2]))
        self.assertFalse(camera_bull_corner_choice(self.state, self.before, self.before['hits']))


if __name__ == '__main__': unittest.main()
