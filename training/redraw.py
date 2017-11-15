"""
Also reference: https://github.com/shuuki4/DRAW-tensorflow/blob/master/DRAW.py


REDRAW.py

REstricted Differentiable Recurrent Attentional Writer
for image vectorization and generation.

Zicheng Gao <kaynato@live.com>

We consider some different ideas about the methods involved...
    
Encoding method: IMAGE -> LATENT
    E1: Zone separation [segmentation generation]
    E2: Separate attendance to each zone
        (Maybe use classifier loss.)

Decoding method: LATENT -> IMAGE
    D1: Edge-image pregeneration (cf. "lineart") (?)
        (cf Holistic Edge Detection? [2])
    D2: iter with increasing detail
    D3:   Flat color zone generation (cf. "flats")
    D4:   Greyscale toning (cf. "shading")

It's likelier that we only need one side, as
    both consuming and producing should draw the
    image in the forward (or backward) order.

==============================

Pseudointroduction:

Recent advances in image generation using Generative Adversarial
    Networks [5] have enabled the quick and straightforward production
    of mostly realistic images [4] or translation between any two
    coherent groups of images [7] [8]. However, the production of images
    using most Deconvolutional / Convolutional architectures produces
    distinctly nonhuman results and artifacts that are difficult
    to produce using most digital art platforms.

To this end, sequence models have been developed for the generation
    of vector text (chinese characters) [9] and recently, with Google's
    "Quick! Draw" dataset, crude sketches as well [1], allowing for
    a visual autocomplete in sketch space that offers ordered, followable
    guides.

The goal of REDRAW is to achieve arbitrary image generation with
    similarly human-readable instructions through restricting the
    generative process to become more in-line with human production methods.
    For example, usage of the line tool and paintbrush is much simpler
    than any deconvolution - especially so for a human artist to implement.
    This provides the additional benefit of massively simplifying
    our model, and presumably allowing for deeper compression of our image(s).

Methods exist for vector sequences of a uniform size [1]
    and for colorization of real images [10] and sketches [11].
    While work has been performed on converting sketches into vectorization-amenable
    "cleaned" formats as in [12] and [13], this is not readily applicable to
    the vectorization of full-color images, which we desire.

All-in-all, REDRAW should be capable of vectorizing arbitrary images
    into ordered sequences of strokes, which can massively supplement the
    landscape of vector image data which is much smaller than that of
    raster images.

As well, it is possible that using REDRAW to approximate photos or
    natural images can produce interesting results.

The writer in the DRAW model [3] is most promising for this task. One need only
    ensure that the writer is uniform and of predictable shape and size.

To ensure that the writer acts in a more human manner, we make the following changes:
    - Only allow quantized size jumps
    - Only allow color jumps
    - Allow only certain configurations of window output ("brush")
            Square? Circle? Either?
    - Add cost for switching of quantized variables (size, color)
    - Add cost for picking up the brush

    - Step cost (encourage speedy completion of drawing)

    - Restrict movement within a certain magnitude
    - End if movement is too small
            Separate stop signal?
            Cost threshold?

    Probably conv to 5[3x3] & GAP for movement.


Possible future investigation:
    Brush dynamics (Model brush based on physical system / photoshop brushes)
        (Keep it similar to freely available drawing platforms.)

"""

import os
import sys
import glob

import numpy as np

import tensorflow as tf
import tensorpack as tp

# Small zero.
EPS = 1e-12

# Magic constants produced through optimization trials
CONST_k = 16.0
CONST_p = 1.0012131648204332
TOLERANCE = 3.0 / 255.0

tf.flags.DEFINE_string("data_dir", "", "Data directory")
tf.flags.DEFINE_integer("steps", 5, "Number of steps to take in a single network iteration")
tf.flags.DEFINE_integer("input_size", 256, "MxM size to resize all inputs to")
tf.flags.DEFINE_integer("memory_size", 64, "Size of NxN intermediate spatial memory")
tf.flags.DEFINE_integer("gker_size", 9, "Size of symmetric gaussian kernel for erosion")
FLAGS = tf.flags.FLAGS



class Model(tp.ModelDesc):

    def __init__(self):
        """
        Initialize network parameters and
            internal variables not included by tensorpack / tensorflow
        """
        # Unwound size of input
        self.unwound_size = (FLAGS.input_size ** 2) * 3

        # Dimension of spatial memory
        self.memory_dims = tf.constant(FLAGS.memory_size,
                                              dtype='float32',
                                              shape=[1, 2],
                                              name='memory_dims')

        # Range [0 ... memory_size]
        self.memory_range = tf.range(float(FLAGS.memory_size))

        # We only need idx from data, so instantiation via numpy is a-ok.
        idx_range = np.r_[:FLAGS.input_size]
        idx_mesh = np.stack(np.meshgrid(idx_range, idx_range), axis=2)
        idx_mesh = idx_mesh[None, :]
        self.state_idx = tf.convert_to_tensor(idx_mesh)

        # Range [0 ... state_size]
        self.state_range = tf.range(float(FLAGS.input_size))

        # {-1, 1}
        self.anti_vec = tf.reshape(tf.constant([-1, 1], dtype='float32'), [1, 2])

    def _get_inputs(self):
        return [tp.InputDesc(tf.float32, (None, flags.input_size, flags.input_size, 3), 'target'),
                tp.InputDesc(tf.float32, (None, flags.input_size, flags.input_size, 3), 'prev_state'),
                tp.InputDesc(tf.float32, (None, 2), 'prev_pos'),
                tp.InputDesc(tf.float32, (None, 1), 'prev_width'),
                tp.InputDesc(tf.float32, (None, 3), 'prev_color')]

    def __build_graph(self, inputs):
        """
        Initialize tensorflow graph.
    
        1-step network. Use as Value network to populate a tree.

        Outputs:
            Next Start Location (2, 3)
            Next Brush Width (3)
            Next Brush Color (3)
            Next End Location (1, 2, 3)
            Next State (1, 2, 3)
            Next Reconstruction Loss (1, 2, 3)
        """

        target, prev_state, prev_pos, prev_width, prev_color = inputs

        # Difference-masked target
        with tf.name_scope('calc_delta'):
            delta = target * tf.square(tf.sign(target - prev_state))

        def est_next_start(delta, prev_pos, color, name):

            # Sharpness and width of attentional read
            read_sigma, read_delta = self.est_read_params(delta, prev_pos)

            # Attentional read
            with tf.name_scope('read_memory'):
                read_memory = self.attn_read(delta, prev_pos, read_sigma, read_delta)

            # Next start centered in memory
            # [B, mH, mW, 2]
            with tf.name_scope('weigh_indices'):
                extracted_indices = self.attn_read(self.state_idx, prev_pos,
                                                   read_sigma, read_delta)
                likely_corners =  self.start_extract(read_memory, color)
                # Sum-normalize likely_corners over image dimensions
                # TODO
                weighed_indices = likely_corners * extracted_indices 

            # "Picky conv?" What on earth...
            # We don't want to just barge in with a bunch of maxpooling.
            # It's probably a good idea to perform some sort of range-preserving conv.
            # This is the important part, actually.

            raise NotImplementedError()

            # [B, 2]
            next_start_mem = tf.reduce_mean(weighed_indices, (1, 2))

            offset = prev_pos - self.memory_dims
            next_pos_start = tf.add(next_start_mem, offset, name=name)
            return next_pos_start

        # Old brush with move
        with tf.variable_scope('est_next_start_old'):
            next_pos_start_old = est_next_start(prev_state, delta,
                                                color=prev_color,
                                                name='next_pos_start_old')

        # New brush with move
        with tf.variable_scope('est_next_start_new'):
            next_pos_start_new = est_next_start(prev_state, delta,
                                                color=None,
                                                name='next_pos_start_new')

        # New brush only is allowed if we move the brush. (2 : NEW-MOVE)
        with tf.variable_scope('est_next_brush'):
            # [B, 1, 1, 3]
            next_color = self.sample_color(delta, next_pos_start,
                                           name='next_color')
            color_delta_new = tf.square(next_color - delta)
            next_width = self.est_local_color_width(color_delta_new, next_pos_start,
                                                    name='next_width')

        # Estimate end of line segment
        with tf.variable_scope('est_next_end'):
            # But we do need old color delta for the move-keep option.
            color_delta_old = tf.square(prev_color - delta)
                
            # here we do the final sub/nosub.
            # Old brush
            eroded_old = self.erode(color_delta_old, prev_color)

            # New brush
            eroded_new = self.erode(color_delta_new, next_color)

            # Estimate endpoint of brushstroke given color erosion and starting position
            next_pos_final_0 = self.est_hough_offset(eroded_old, prev_pos,
                                                     name='next_pos_final_old')
            next_pos_final_1 = self.est_hough_offset(eroded_old, next_pos_start_old,
                                                     name='next_pos_final_old_move')
            next_pos_final_2 = self.est_hough_offset(eroded_new, next_pos_start_new,
                                                     name='next_pos_final_new_move')

        # Gather actions for extraction and processing
        outputs = {
            # [_, next_pos_final_old, _, _]
            'keep_stay': [prev_pos, next_pos_final_0, prev_width, prev_color],
            # [next_pos_start_old, next_pos_final_old_move, _, _]
            'keep_move': [next_pos_start_old, next_pos_final_1, prev_width, prev_color],
            # [next_pos_start_new, next_pos_final_new_move, next_width, next_color]
            'new_move': [next_pos_start_new, next_pos_final_2, next_width, next_color],
        }

        # Apply actions to find next states
        with tf.name_scope('transition'):
            next_states = {name: self.apply_action(prev_state, *action, name=name)
                           for name, action in outputs.items()}

        # Calculate losses from states
        with tf.name_scope('losses'):
            loss = {name: self.loss(goal, next_state, name=name)
                    for name, next_state in outputs.items()}

            self.cost = tf.add_n(loss.values(), name='total_loss')

    def sq_dist(self, center):
        """Calculate distance in state space from at [center]."""
        # Line up dimensions.
        # [B, W, H, (x, y)] - [B, 1, 1, 2]
        with tf.name_scope('sq_dist'):
            diff = self.state_idx - tf.reshape(center, [-1, 1, 1, 2])
            dist = tf.sqrt(tf.reduce_sum(tf.square(diff), 3, keep_dims=True))
            # [B, W, H, 1]
            return dist

    def learned_gaussians(self, diameter, tensor2d, scope):
        """Learnable channel-preserving gaussian filter for 1ch -> 1ch"""
        k = float(diameter)
        with tf.variable_scope(scope):
            with tf.name_scope('learned_gaussians'):
                # [k]
                log_sigma2 = tf.Variable(1.0, trainable=True, name='log_sigma2')
                ker_x = tf.range(k) - (k / 2) - 0.5
                ker_gauss = tf.exp(-tf.square(ker_x) / (2 * tf.exp(log_sigma2)))
                ker_gauss = tf.reshape(ker_gauss, [1, ])

    def est_read_params(self, state, center):
        """Calculate sigma and delta for attentional read from state at center."""
        with tf.name_scope('est_read_params'):
            color_mag = tf.norm(state, ord='2', axis=3, keep_dims=True)
            weighed_mag = color_mag * self.sq_dist(center)

            # sigma, delta calculation
            # TODO: consider using at least one gaussian conv as init
            # TODO: consider forcing symmetric conv. [bHWc] and [bWHc]. same weights.
            with argscope([tp.Conv2D], nl=tf.nn.elu, padding='SAME'):
                def mat_to_scalar_subnet(state, scope):
                    # 64x downscale in calculation.
                    # Consider by presence -> Maxpool
                    with tf.variable_scope(scope):
                        l = tp.Conv2D('conv_0', state, 3, 7, stride=2)
                        l = tp.MaxPooling('down_0', l, 2)
                        l = tp.Conv2D('conv_1', l, 12, 1)
                        l = tp.MaxPooling('down_1', l, 2)
                        l = tp.Conv2D('conv_2', l, 6, 3, stride=2)
                        # Something like adaptive pooling.
                        # Should we use a symmetric filter?
                        l = tp.Conv2D('conv_down_3', l, 6, 7, stride=4)
                        l = tp.FullyConnected('fc0', l, 16)
                        # Consider how nl affects outputs and gradients...
                        # These should all be positive and > 1, so it's fine.
                        l = tp.FullyConnected('fct', l, 1, nl=tf.identity)
                        # Now they are definitely > 1
                        # Most attentional read operations prefer to use
                        # Logarithmic outputs and exponential here
                        # It's supposedly for better gradients but
                        # It's because keeping it positive is best this way
                        # As max(0, x) is bad for backprop
                        out = tf.exp(l)
                    return out
                sigma = mat_to_scalar_subnet(weighed_mag, scope='sigma')
                delta = mat_to_scalar_subnet(weighed_mag, scope='delta')
            return sigma, delta

    def attn_read(self, state, center, read_sigma, read_delta):
        """Apply the attentional read operation defined by DRAW."""

        with tf.name_scope('attn_read'):
            # Centered memory range
            # [B, range, _, _]
            mem_c_range = self.memory_range - 0.5 - (FLAGS.memory_size / 2.0)
            mem_c_range = tf.reshape(mem_c_range, [1, -1, 1, 1])

            # Reshape delta
            read_delta = tf.reshape(read_delta, [-1, 1, 1, 1])

            # Rescale using delta
            # [B, mem_range, _, _]
            ex_mem_c_range = mem_c_range * read_delta

            # Recenter to get means of gaussians
            # [B, mem_range, _, (x, y)]
            gauss_means = center + ex_mem_c_range

            # State range
            # [B, _, st_range, _]
            st_range = tf.reshape(self.state_range, [1, 1, -1, 1])

            # Reshape sigma
            read_sigma = tf.reshape(read_sigma, [-1, 1, 1, 1])

            # Value that goes inside the exponent for a gaussian
            # [B, to, from, (x, y)]
            gauss_internal = (st_range - gauss_means) / (2*read_sigma)
            gaussian_readers = tf.exp(-tf.square(gauss_internal))

            # normalize, sum over img dims (from)
            # [B, to, from, (x, y)]
            gaussian_sum = tf.reduce_sum(gaussian_readers, 2, keep_dims=True)
            gaussian_readers = gaussian_readers / tf.maximum(gaussian_sum, EPS)

            # [B, to, from, 1 -> 3]
            read_x, read_y = tf.split(gaussian_readers, 2, axis=3)
            img_ch = tf.convert_to_tensor(state).shape.as_list()[-1]
            read_x = tf.tile(read_x, [1, 1, 1, img_ch])
            read_y = tf.tile(read_y, [1, 1, 1, img_ch])

            # Transpose to prepare for matmul
            # [Batch, Channel, Height, Width]
            read_x_bc = tf.transpose(read_x, perm=[0, 3, 1, 2])
            read_y_bc_tr = tf.transpose(read_y, perm=[0, 3, 2, 1])
            state_bc = tf.transpose(state, perm=[0, 3, 1, 2])
            
            memory_bc = tf.matmul(tf.matmul(read_x_bc, state_bc), read_y_bc_tr)
            memory = tf.transpose(memory_bc, [0, 2, 3, 1])
        return memory

    def start_extract(self, delta, color):
        """
        Erode values in delta to give positive values for "inland pixels"
        Use symmetric convolution(s) with gaussian priors.

        Color can be None. It describes the previous color of a brush.
        If Color is None, we are allowed to decide for ourselves.
        """
        # Delta is all positive anyway; we can just add safely
        if color is None:
            delta_presence = tf.reduce_mean(tf.square(delta), axis=3, keep_dims=True)
        else:
            delta_presence = tf.reduce_mean(tf.square(delta - color), axis=3, keep_dims=True)

        # Importance by wideness
        w_wide = self.learned_gaussians(FLAGS.gker_size, delta_presence, scope='erode')

        # Importance by corners
        w_corn = self.corner_convs(delta_presence)

        # Importance by mysterious learned convolution(s)
        # But these need to be applied symmetrically.
        # TODO
        with tf.variable_scope('learn_conv' + '' if color is None else '_colored'):
            with argscope([tp.Conv2D], nl=tf.nn.elu, padding='SAME'):
                l = delta_presence
                # TODO reach into these convs and reuse the weights
                # Use same weights, honestly...
                # https://arxiv.org/pdf/1405.3866.pdf
                l = tp.Conv2D('conv_0_h', l, 4, (5, 1))
                l = tp.Conv2D('conv_0_w', l, 4, (1, 5))



        raise NotImplementedError()

    def sample_color(self, delta, pos):
        """
        Sample [B, 1, 1, 3] color from delta at position
        Use some sort of selection pooling. Hmm.
        Voting?
        """
        raise NotImplementedError()

    def est_local_color_width(self, cdelta, pos):
        """
        Estimate best width for brush with color on color-delta at position
        Use mean pooling and convs.
        """
        raise NotImplementedError()

    def erode(self, cdelta, diameter):
        """
        Erode cdelta by radius.
        Straightforward symmetric conv.
        """
        raise NotImplementedError()

    def est_hough_offset(self, guide, pos):
        """
        Estimate a good terminating position for a line segment starting from pos
        using guide to determine viablity of paths.
        An estimation of a Hough filter is a good idea.
        """
        raise NotImplementedError()

    def apply_action(self, state, start, end, width, color, name):
        """
        Draw line segment of color to state between start and end with width
        """
        with tf.name_scope('apply_action'):
            color_bc = tf.reshape(color, [-1, 1, 1, 3])
            mid_bc = tf.reshape((start + end) / 2.0, [-1, 1, 1, 2])
            
            line = end - start
            # Normal vec, broadcastable
            orth_bc = tf.nn.l2_normalize(tf.reverse(line, axis=[1]) * self.anti_vec, dim=1)
            orth_bc = tf.reshape(orth_bc, [-1, 1, 1, 2])
            # Direction, broadcastable
            line_bc = tf.nn.l2_normalize(line, dim=1)
            line_bc = tf.reshape(line_bc, [-1, 1, 1, 2])
            
            # Calculation of line width and height
            width_ph = CONST_p * width / 2.0
            line_norm = tf.norm(line, ord='euclidean', axis=1, keep_dims=True)
            line_len_h = width_ph + line_norm / 2.0
            line_dim_min = tf.minimum(line_len_h, width_ph)
            line_len_sq = tf.square(line_len_h)
            width_p_sq = tf.square(width_ph)
            exp_x = tf.reshape(line_len_h / line_dim_min, [-1, 1, 1, 1])
            exp_y = tf.reshape(width_ph / line_dim_min, [-1, 1, 1, 1])
                
            # Offset coordinates
            st_offset = tf.expand_dims(state_idx, axis=0) - mid_bc
            
            # Rotate coordinates
            st_xa = tf.reduce_sum(st_offset * line_bc, axis=3, keep_dims=True)
            st_ya = tf.reduce_sum(st_offset * orth_bc, axis=3, keep_dims=True)
            
            # Scale and power
            st_x = tf.pow(tf.square(st_xa) / line_len_sq, exp_x)
            st_y = tf.pow(tf.square(st_ya) / width_p_sq, exp_y)

            # Combine
            st = st_x + st_y

            # State-mask via k-Sigmoid
            st = tf.sigmoid(CONST_k * (1 - st))

            new_state = tf.add(state * (1 - st), st * color_bc, name=name)

        return new_state

    def loss(self, goal, state):
        goal_diff = goal - state
        # Add colors together. Cumulative error shouldn't be high.
        threshold_diff = tf.nn.relu(tf.reduce_sum(tf.square(goal_diff) - TOLERANCE, axis=3))
        goal_loss = tf.reduce_sum(threshold_diff, axis=(1, 2))
        goal_loss = tf.reduce_mean(goal_loss)
        return goal_loss

    def _get_optimizer(self):
        """
        Tensorpack neccessity. Define optimizer for training.
        """
        lr = tp.symbolic_functions.get_scalar_var('learning_rate', 2e-3, summary=True)
        opt = tf.train.AdamOptimizer(lr)
        return tp.optimizer.apply_grad_processors(opt, [tp.GlobalNormClip(5)])

# NEED WRAPPER FOR DATAFLOW
def get_data():
    raise NotImplementedError()
    # ds = RandomImageData(param.corpus, 100000)
    ds = tp.BatchData(ds, param.batch_size)

# Are further modifications desirable?
def get_config():
    tp.logger.auto_set_dir()
    return tp.TrainConfig(
        dataflow=get_data(),
        callbacks=[
            tp.ModelSaver(),
            # tp.ScheduledHyperParamSetter('learning_rate', [(25, 2e-4)])
        ],
        model=Model(),
        max_epoch=1000,
    )

# NEED TRUE COST TAILORING ON ACTION EXPANSION TREE
def astar_heuristic(state_node, goal):
    raise NotImplementedError()

# NEED A* SEARCH ON ACTION EXPANSION TREE USING TRUE COST AND GROUPED WRONG PIXEL HEURISTIC
class StateNode(object):
    pass
    # raise NotImplementedError()

# Batched node expansion...? Taking advantage would be nice, but
# We would have to be careful with order and/or use a priority queue.
def expand_node(curr_node, inference_model):
    # should perform inference
    raise NotImplementedError()

"""
References:
[1] https://arxiv.org/abs/1704.03477
    sketch-rnn
    Vector image sketch AE with seq2seq & hypnet.

[2] https://arxiv.org/abs/1504.06375
    holistically nested edge detection

[3] https://arxiv.org/abs/1502.04623
    DRAW

[4] https://arxiv.org/abs/1609.03552
    interactive REALISTIC NATURAL image generation
    with GAN

[5] https://arxiv.org/abs/1406.2661
    GAN

[6] https://arxiv.org/abs/1603.01768
    neural doodle (semantic style transfer)
    It's class conditional DCGAN in-image.

[7] https://arxiv.org/abs/1611.07004
    pix2pix

[8] https://arxiv.org/abs/1703.10593
    cycleGAN

[9] http://blog.otoro.net/2015/12/28/recurrent-net-dreams-up-fake-chinese-characters-in-vector-format-with-tensorflow/

[10] https://richzhang.github.io/ideepcolor/
[11] https://paintschainer.preferred.tech/index_en.html

"""
