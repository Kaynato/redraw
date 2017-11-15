describe('MPState', function() {
    it('should show current stroke is null', async function() {
        assert.isNull(MPState.getCurrentStroke(), 'Current Stroke is null')
    });
});